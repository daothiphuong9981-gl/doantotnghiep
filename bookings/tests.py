import threading
import time
from django.test import TransactionTestCase
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction, OperationalError
from django.core.exceptions import ValidationError
from django.urls import reverse

from courts.models import Court, TimeSlot
from bookings.models import Booking

User = get_user_model()

class BookingConcurrencyTests(TransactionTestCase):
    """
    Unit Test verify concurrent bookings and double-booking prevention.
    Uses TransactionTestCase to allow multi-threaded DB access.
    """
    
    def setUp(self):
        # 1. Create test accounts
        self.owner = User.objects.create_user(
            username='owner_test', password='password123', role='OWNER'
        )
        self.player1 = User.objects.create_user(
            username='player1', password='password123', role='PLAYER'
        )
        self.player2 = User.objects.create_user(
            username='player2', password='password123', role='PLAYER'
        )

        # 2. Create court and timeslot
        self.court = Court.objects.create(
            owner=self.owner,
            name='Sân Concurrency Test',
            district='Hải Châu',
            address='123 Núi Thành',
            latitude=16.05,
            longitude=108.21,
            description='Sân dùng để test đặt lịch đồng thời'
        )
        self.slot = TimeSlot.objects.create(
            court=self.court,
            start_time='08:00',
            end_time='10:00',
            price=120000
        )
        self.booking_date = '2026-07-10'

    def test_double_booking_prevention_concurrency(self):
        """
        Simulate 2 players attempting to book the same timeslot concurrently.
        Thread 1 runs first, Thread 2 runs shortly after.
        Assert: Only 1 booking is successfully created in the database.
        """
        results = []
        errors = []

        def attempt_booking(player, name, delay=0):
            if delay > 0:
                time.sleep(delay)
            try:
                with transaction.atomic():
                    # select_for_update() locks the slot row
                    locked_slot = TimeSlot.objects.select_for_update().get(id=self.slot.id)
                    
                    # Double check constraint
                    exists = Booking.objects.filter(
                        court=self.court,
                        time_slot=locked_slot,
                        date=self.booking_date,
                        status__in=['PENDING', 'CONFIRMED']
                    ).exists()
                    
                    if exists:
                        raise ValidationError("Khung gio da duoc dat truoc.")

                    # Create booking
                    booking = Booking.objects.create(
                        player=player,
                        court=self.court,
                        time_slot=locked_slot,
                        date=self.booking_date,
                        total_price=locked_slot.price,
                        status='PENDING'
                    )
                    results.append(booking)
                    print(f"[{name}] Booking success! ID: {booking.id}")
            except (ValidationError, IntegrityError, OperationalError) as e:
                errors.append(e)
                print(f"[{name}] Booking blocked: {str(e)}")

        # Thread 1 starts immediately, Thread 2 starts with a tiny delay (0.05s) to allow Thread 1 to lock/write first
        t1 = threading.Thread(target=attempt_booking, args=(self.player1, 'Player 1', 0))
        t2 = threading.Thread(target=attempt_booking, args=(self.player2, 'Player 2', 0.05))

        t1.start()
        t2.start()

        t1.join()
        t2.join()

        # Check total bookings in DB
        total_bookings = Booking.objects.filter(
            court=self.court,
            time_slot=self.slot,
            date=self.booking_date
        ).count()

        # Only exactly 1 booking must be registered
        self.assertEqual(total_bookings, 1)
        self.assertEqual(len(results), 1)
        self.assertEqual(len(errors), 1)
        
        print(f"\n---> TEST RESULT: Total bookings in DB: {total_bookings}")
        print(f"---> Success: {len(results)}, Blocked: {len(errors)}")

    def test_why_db_constraint_is_safer_than_form_check(self):
        """
        Prove that DB constraint (UniqueConstraint) is the ultimate safeguard.
        """
        # Create first booking
        Booking.objects.create(
            player=self.player1,
            court=self.court,
            time_slot=self.slot,
            date=self.booking_date,
            total_price=self.slot.price,
            status='PENDING'
        )
        
        # Creating a duplicate booking must raise IntegrityError at DB level
        with self.assertRaises(IntegrityError):
            Booking.objects.create(
                player=self.player2,
                court=self.court,
                time_slot=self.slot,
                date=self.booking_date,
                total_price=self.slot.price,
                status='PENDING'
            )
        print("\n---> TEST RESULT: DB UniqueConstraint successfully blocked double booking.")


class BookingAuthorizationTests(TransactionTestCase):
    """
    Unit Test verify role authorization and IDOR prevention for Booking management.
    """
    
    def setUp(self):
        self.owner1 = User.objects.create_user(username='owner1', password='password123', role='OWNER')
        self.owner2 = User.objects.create_user(username='owner2', password='password123', role='OWNER')
        self.player1 = User.objects.create_user(username='player1', password='password123', role='PLAYER')
        self.player2 = User.objects.create_user(username='player2', password='password123', role='PLAYER')
        
        self.court1 = Court.objects.create(
            owner=self.owner1,
            name='Sân Owner 1',
            district='Hải Châu',
            address='123 Núi Thành',
            latitude=16.05,
            longitude=108.21
        )
        self.slot1 = TimeSlot.objects.create(
            court=self.court1,
            start_time='08:00',
            end_time='10:00',
            price=100000
        )
        self.booking1 = Booking.objects.create(
            player=self.player1,
            court=self.court1,
            time_slot=self.slot1,
            date='2026-07-15',
            total_price=100000,
            status='PENDING'
        )

    def test_player_cannot_access_owner_dashboard(self):
        """TC-18: Player truy cập dashboard chủ sân bị redirect hoặc báo lỗi 403"""
        self.client.login(username='player1', password='password123')
        response = self.client.get(reverse('bookings:owner_bookings'))
        self.assertIn(response.status_code, [302, 403])
        print("\n---> TEST RESULT: Player blocked from Owner Dashboard.")

    def test_player_cannot_cancel_others_booking_idor(self):
        """TC-19: Player A cố tình hủy booking của Player B bị chặn (IDOR)"""
        self.client.login(username='player2', password='password123')
        response = self.client.get(reverse('bookings:booking_cancel_player', args=[self.booking1.id]))
        self.assertEqual(response.status_code, 302)
        self.booking1.refresh_from_db()
        self.assertEqual(self.booking1.status, 'PENDING')
        print("\n---> TEST RESULT: Player A blocked from cancelling Player B's booking (IDOR).")

    def test_owner_cannot_approve_others_court_booking_idor(self):
        """TC-20: Chủ sân A cố tình duyệt booking sân của Chủ sân B bị chặn (IDOR)"""
        self.client.login(username='owner2', password='password123')
        response = self.client.get(reverse('bookings:booking_approve', args=[self.booking1.id]))
        self.assertEqual(response.status_code, 302)
        self.booking1.refresh_from_db()
        self.assertEqual(self.booking1.status, 'PENDING')
        print("\n---> TEST RESULT: Owner 2 blocked from approving Owner 1's court booking (IDOR).")


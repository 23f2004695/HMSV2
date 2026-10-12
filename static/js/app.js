const { createApp, ref, onMounted } = Vue;

const app = createApp({
    setup() {
        const s = window.store;
        const authMode = ref('login');
        const findDoctorDeptId = ref('');
        const viewHistoryPatientId = ref(null);

        onMounted(() => {
            if (s.isLoggedIn) {
                loadInitialData();
            }
        });

        async function loadInitialData() {
            await s.loadDepartments();
            if (s.user.role === 'admin') {
                await s.loadStats();
            }
        }

        function handleFindDoctorDept(deptId) {
            findDoctorDeptId.value = deptId;
            s.navigate('find-doctor');
        }
 
        function handleViewHistory(patientId) {
            viewHistoryPatientId.value = patientId;
            s.navigate('patient-history');
        }

        return {
            store: s,
            authMode,
            findDoctorDeptId,
            viewHistoryPatientId,
            loadInitialData,
            handleFindDoctorDept,
            handleViewHistory
        };
    },
    watch: {
        // Forget the department picked from the dashboard once the user leaves Find Doctor
        'store.currentPage'(page) {
            if (page !== 'find-doctor') this.findDoctorDeptId = '';
        },
        // user logs in, load dashboard data
        'store.isLoggedIn'(val) {
            if (val) {
                this.loadInitialData();
                this.store.navigate('dashboard');
            }
        }
    },
    template: `
        <!-- Navbar Component -->
        <app-navbar></app-navbar>

        <!-- Auth Pages (not logged in) -->
        <div v-if="!store.isLoggedIn" class="container mt-5">
            <div class="row justify-content-center">
                <div class="col-md-5">
                    <div class="text-center mb-4">
                        <h2 class="text-primary"><i class="bi bi-hospital"></i> Hospital Management System</h2>
                        <p class="text-muted">Manage patients, doctors, and appointments efficiently</p>
                    </div>
                    <login-form    v-if="authMode === 'login'"    @switch-to-register="authMode = 'register'"></login-form>
                    <register-form v-if="authMode === 'register'" @switch-to-login="authMode = 'login'"></register-form>
                </div>
            </div>
        </div>

        <!-- Main Content -->
        <div v-if="store.isLoggedIn" class="container-fluid mt-3">
            <!-- Global Alert Component -->
            <alert-message></alert-message>

            <!-- Role-Based Dashboards -->
            <admin-dashboard   v-if="store.currentPage === 'dashboard' && store.user.role === 'admin'"></admin-dashboard>

            <doctor-dashboard  v-if="store.currentPage === 'dashboard' && store.user.role === 'doctor'"
                @open-treatment="$refs.treatmentModal.show($event)"
                @view-history="handleViewHistory">
            </doctor-dashboard>

            <patient-dashboard v-if="store.currentPage === 'dashboard' && store.user.role === 'patient'"
                @find-doctor-dept="handleFindDoctorDept"
                @reschedule="$refs.rescheduleModal.show($event)">
            </patient-dashboard>

            <!-- Page Components -->
            <doctors-list      v-if="store.currentPage === 'doctors'"></doctors-list>

            <patients-list     v-if="store.currentPage === 'patients'"
                @view-history="handleViewHistory">
            </patients-list>

            <appointments-list v-if="store.currentPage === 'appointments'"
                @open-treatment="$refs.treatmentModal.show($event)"
                @view-treatment="$refs.treatmentModal.show($event, true)"
                @reschedule="$refs.rescheduleModal.show($event)">
            </appointments-list>

            <find-doctor       v-if="store.currentPage === 'find-doctor'"
                :initial-dept-id="findDoctorDeptId"
                @book-doctor="$refs.bookingModal.show($event)"
                @view-availability="$refs.availabilityModal.show($event)">
            </find-doctor>

            <availability-manager v-if="store.currentPage === 'availability'"></availability-manager>

            <patient-history   v-if="store.currentPage === 'my-history'"
                title="My Treatment History" :show-export="true">
            </patient-history>

            <patient-history   v-if="store.currentPage === 'patient-history'"
                :patient-id="viewHistoryPatientId" title="Patient History">
            </patient-history>

            <profile-page      v-if="store.currentPage === 'profile'"></profile-page>

            <!-- Shared Modal Components -->
            <booking-modal     ref="bookingModal"     @booked="store.loadAppointments()"></booking-modal>
            <treatment-modal   ref="treatmentModal"    @saved="store.loadAppointments()"></treatment-modal>
            <reschedule-modal  ref="rescheduleModal"   @rescheduled="store.loadAppointments()"></reschedule-modal>
            <availability-modal ref="availabilityModal"></availability-modal>
        </div>
    `
});

//  Register All Components 
app.component('alert-message',       window.AlertMessage);
app.component('app-navbar',          window.AppNavbar);

app.component('login-form',          window.LoginForm);
app.component('register-form',       window.RegisterForm);

app.component('admin-dashboard',     window.AdminDashboard);
app.component('doctor-dashboard',    window.DoctorDashboard);
app.component('patient-dashboard',   window.PatientDashboard);

app.component('doctors-list',        window.DoctorsList);
app.component('patients-list',       window.PatientsList);
app.component('appointments-list',   window.AppointmentsList);
app.component('find-doctor',         window.FindDoctor);
app.component('availability-manager', window.AvailabilityManager);
app.component('patient-history',     window.PatientHistory);
app.component('profile-page',        window.ProfilePage);

app.component('doctor-modal',        window.DoctorModal);
app.component('booking-modal',       window.BookingModal);
app.component('treatment-modal',     window.TreatmentModal);
app.component('reschedule-modal',    window.RescheduleModal);
app.component('availability-modal',  window.AvailabilityModal);

app.mount('#app');

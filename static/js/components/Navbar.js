window.AppNavbar = {
    template: `
        <nav class="navbar navbar-expand-lg navbar-dark bg-primary" v-if="store.isLoggedIn">
            <div class="container-fluid">
                <a class="navbar-brand" href="#" @click.prevent="store.navigate('dashboard')">
                    <i class="bi bi-hospital"></i> HMS
                </a>
                <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                    <span class="navbar-toggler-icon"></span>
                </button>
                <div class="collapse navbar-collapse" id="navbarNav">
                    <ul class="navbar-nav me-auto">
                        <li class="nav-item">
                            <a class="nav-link" :class="{active: store.currentPage === 'dashboard'}" href="#" @click.prevent="store.navigate('dashboard')">Dashboard</a>
                        </li>
                        <li class="nav-item" v-if="store.user.role === 'admin'">
                            <a class="nav-link" :class="{active: store.currentPage === 'doctors'}" href="#" @click.prevent="store.navigate('doctors')">Doctors</a>
                        </li>
                        <li class="nav-item" v-if="store.user.role === 'admin'">
                            <a class="nav-link" :class="{active: store.currentPage === 'patients'}" href="#" @click.prevent="store.navigate('patients')">Patients</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" :class="{active: store.currentPage === 'appointments'}" href="#" @click.prevent="store.navigate('appointments')">Appointments</a>
                        </li>
                        <li class="nav-item" v-if="store.user.role === 'patient'">
                            <a class="nav-link" :class="{active: store.currentPage === 'find-doctor'}" href="#" @click.prevent="store.navigate('find-doctor')">Find Doctor</a>
                        </li>
                        <li class="nav-item" v-if="store.user.role === 'doctor'">
                            <a class="nav-link" :class="{active: store.currentPage === 'availability'}" href="#" @click.prevent="store.navigate('availability')">My Availability</a>
                        </li>
                        <li class="nav-item" v-if="store.user.role === 'patient'">
                            <a class="nav-link" :class="{active: store.currentPage === 'my-history'}" href="#" @click.prevent="store.navigate('my-history')">My History</a>
                        </li>
                    </ul>
                    <ul class="navbar-nav">
                        <li class="nav-item">
                            <a class="nav-link" href="#" @click.prevent="store.navigate('profile')">
                                <i class="bi bi-person-circle"></i> {{ store.user.name }}
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="#" @click.prevent="store.logout()">
                                <i class="bi bi-box-arrow-right"></i> Logout
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </nav>
    `,
    setup() {
        return { store: window.store };
    }
};

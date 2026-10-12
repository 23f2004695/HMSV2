window.RegisterForm = {
    emits: ['switch-to-login'],
    template: `
        <div class="card shadow">
            <div class="card-header bg-success text-white text-center">
                <h4 class="mb-0">Patient Registration</h4>
            </div>
            <div class="card-body p-4">
                <div class="alert alert-danger" v-if="error">{{ error }}</div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Full Name *</label>
                        <input type="text" class="form-control" v-model="form.name" required>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Username *</label>
                        <input type="text" class="form-control" v-model="form.username" required>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Email *</label>
                    <input type="email" class="form-control" v-model="form.email" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Password *</label>
                    <input type="password" class="form-control" v-model="form.password" required>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Phone</label>
                        <input type="text" class="form-control" v-model="form.phone">
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Date of Birth</label>
                        <input type="date" class="form-control" v-model="form.date_of_birth" :max="todayStr">
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Gender</label>
                        <select class="form-select" v-model="form.gender">
                            <option value="">Select</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Blood Group</label>
                        <select class="form-select" v-model="form.blood_group">
                            <option value="">Select</option>
                            <option v-for="bg in bloodGroups" :key="bg" :value="bg">{{ bg }}</option>
                        </select>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Address</label>
                    <textarea class="form-control" v-model="form.address" rows="2"></textarea>
                </div>
                <button class="btn btn-success w-100" @click="register" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    Register
                </button>
                <p class="text-center mt-3 mb-0">
                    Already have an account? <a href="#" @click.prevent="$emit('switch-to-login')">Login here</a>
                </p>
            </div>
        </div>
    `,
    data() {
        return {
            form: {
                name: '', username: '', email: '', password: '',
                phone: '', date_of_birth: '', gender: '', blood_group: '', address: ''
            },
            error: '',
            loading: false,
            bloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
            todayStr: window.store.todayStr
        };
    },
    methods: {
        async register() {
            this.error = '';
            this.loading = true;
            try {
                const f = this.form;
                if (!f.name.trim() || !f.username.trim() || !f.email.trim() || !f.password) {
                    this.error = 'Please fill in all the required fields';
                    return;
                }
                if (f.password.length < 6) {
                    this.error = 'Password must be at least 6 characters';
                    return;
                }
                const data = await window.store.api('/auth/register', 'POST', this.form);
                window.store.setAuth(data.token, data.user);
            } catch (e) {
                this.error = e.message || 'Registration failed. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};

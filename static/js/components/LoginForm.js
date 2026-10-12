window.LoginForm = {
    emits: ['switch-to-register'],
    template: `
        <div class="card">
            <div class="card-body p-4 p-md-5">
                <h3 class="fw-bold mb-1">Welcome back</h3>
                <p class="text-muted mb-4">Log in as a patient, doctor or admin.</p>
                <div class="alert alert-danger" v-if="error">{{ error }}</div>
                <div class="mb-3">
                    <label class="form-label">Username</label>
                    <input type="text" class="form-control" v-model="form.username" @keyup.enter="login" required>
                </div>
                <div class="mb-3">
                    <label class="form-label">Password</label>
                    <input type="password" class="form-control" v-model="form.password" @keyup.enter="login" required>
                </div>
                <button class="btn btn-primary btn-lg w-100" @click="login" :disabled="loading">
                    <span v-if="loading" class="spinner-border spinner-border-sm me-1"></span>
                    Login
                </button>
                <p class="text-center mt-3 mb-0">
                    Don't have an account? <a href="#" @click.prevent="$emit('switch-to-register')">Register here</a>
                </p>
            </div>
        </div>
    `,
    data() {
        return {
            form: { username: '', password: '' },
            error: '',
            loading: false
        };
    },
    methods: {
        async login() {
            this.error = '';
            this.loading = true;
            try {
                if (!this.form.username.trim() || !this.form.password) {
                    this.error = 'Please enter your username and password';
                    return;
                }
                const data = await window.store.api('/auth/login', 'POST', this.form);
                window.store.setAuth(data.token, data.user);
            } catch (e) {
                this.error = e.message || 'Login failed. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};

window.ProfilePage = {
    template: `
        <div>
            <h3 class="mb-3">My Profile</h3>
            <div class="row g-3">
                <div class="col-md-6">
                    <div class="card shadow-sm">
                        <div class="card-header">Personal details</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Full Name</label>
                                <input type="text" class="form-control" v-model="form.name">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" v-model="form.email">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Phone</label>
                                <input type="text" class="form-control" v-model="form.phone">
                            </div>
                            <template v-if="store.user.role === 'patient'">
                                <div class="mb-3">
                                    <label class="form-label">Date of Birth</label>
                                    <input type="date" class="form-control" v-model="form.date_of_birth" :max="store.todayStr">
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
                                <div class="mb-3">
                                    <label class="form-label">Emergency Contact</label>
                                    <input type="text" class="form-control" v-model="form.emergency_contact">
                                </div>
                            </template>
                            <button class="btn btn-primary" @click="save" :disabled="saving">
                                <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card shadow-sm">
                        <div class="card-header">Change password</div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label class="form-label">Current Password</label>
                                <input type="password" class="form-control" v-model="pw.current_password" autocomplete="current-password">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">New Password</label>
                                <input type="password" class="form-control" v-model="pw.new_password" autocomplete="new-password">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Confirm New Password</label>
                                <input type="password" class="form-control" v-model="pw.confirm" autocomplete="new-password">
                            </div>
                            <button class="btn btn-outline-primary" @click="changePassword">Update Password</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            form: { name: '', email: '', phone: '', date_of_birth: '', gender: '', blood_group: '', address: '', emergency_contact: '' },
            pw: { current_password: '', new_password: '', confirm: '' },
            bloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
            saving: false
        };
    },
    async created() {
        await this.loadProfile();
    },
    methods: {
        async loadProfile() {
            try {
                const data = await this.store.api('/auth/me');
                this.form.name = data.name || '';
                this.form.email = data.email || '';
                this.form.phone = data.phone || '';
                if (data.patient) {
                    this.form.date_of_birth = data.patient.date_of_birth || '';
                    this.form.gender = data.patient.gender || '';
                    this.form.blood_group = data.patient.blood_group || '';
                    this.form.address = data.patient.address || '';
                    this.form.emergency_contact = data.patient.emergency_contact || '';
                }
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async save() {
            const payload = { name: this.form.name, email: this.form.email, phone: this.form.phone };
            if (this.store.user.role === 'patient') {
                Object.assign(payload, {
                    date_of_birth: this.form.date_of_birth,
                    gender: this.form.gender,
                    blood_group: this.form.blood_group,
                    address: this.form.address,
                    emergency_contact: this.form.emergency_contact
                });
            }
            this.saving = true;
            try {
                const user = await this.store.api('/auth/me', 'PUT', payload);
                this.store.updateUser({ name: user.name, email: user.email, phone: user.phone });
                this.store.showAlert('Profile updated successfully');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            } finally {
                this.saving = false;
            }
        },
        async changePassword() {
            if (!this.pw.current_password || !this.pw.new_password) {
                this.store.showAlert('Please fill in your current and new password', 'danger');
                return;
            }
            if (this.pw.new_password !== this.pw.confirm) {
                this.store.showAlert('New passwords do not match', 'danger');
                return;
            }
            try {
                await this.store.api('/auth/me', 'PUT', {
                    current_password: this.pw.current_password,
                    new_password: this.pw.new_password
                });
                this.pw = { current_password: '', new_password: '', confirm: '' };
                this.store.showAlert('Password updated');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};

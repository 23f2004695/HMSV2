window.ProfilePage = {
    template: `
        <div>
            <h3 class="mb-3">My Profile</h3>
            <div class="row">
                <div class="col-md-6">
                    <div class="card shadow-sm">
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
                                    <input type="date" class="form-control" v-model="form.date_of_birth">
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
                            <button class="btn btn-primary" @click="save">Save Changes</button>
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
            bloodGroups: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
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
            } catch (e) { console.error(e); }
        },
        async save() {
            try {
                if (this.store.user.role === 'patient') {
                    const me = await this.store.api('/auth/me');
                    await this.store.api('/patients/' + me.patient.id, 'PUT', this.form);
                }
                // Update store user
                this.store.user.name = this.form.name;
                this.store.user.email = this.form.email;
                this.store.user.phone = this.form.phone;
                localStorage.setItem('hms_user', JSON.stringify(this.store.user));
                this.store.showAlert('Profile updated successfully');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};

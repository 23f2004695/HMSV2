window.AvailabilityManager = {
    template: `
        <div>
            <h3 class="mb-3">Manage My Availability</h3>
            <p class="text-muted">Patients can only book inside these slots. You can open slots for the next 7 days.</p>
            <div class="card shadow-sm mb-3">
                <div class="card-body">
                    <div class="row g-2 align-items-end">
                        <div class="col-md-3">
                            <label class="form-label">Date</label>
                            <input type="date" class="form-control" v-model="newSlot.date" :min="store.todayStr" :max="store.weekLaterStr">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">Start Time</label>
                            <input type="time" class="form-control" v-model="newSlot.start_time">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label">End Time</label>
                            <input type="time" class="form-control" v-model="newSlot.end_time">
                        </div>
                        <div class="col-md-2">
                            <button class="btn btn-primary" @click="addSlot" :disabled="saving">
                                <i class="bi bi-plus-circle"></i> Add Slot
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div class="card shadow-sm">
                <div class="card-header"><h5 class="mb-0">Current Availability (Next 7 Days)</h5></div>
                <div class="card-body p-0">
                    <div class="table-responsive" v-if="slots.length">
                        <table class="table table-hover mb-0">
                            <thead><tr><th>Date</th><th>Start Time</th><th>End Time</th><th>Status</th><th></th></tr></thead>
                            <tbody>
                                <tr v-for="a in slots" :key="a.id">
                                    <td>{{ a.date }}</td><td>{{ a.start_time }}</td><td>{{ a.end_time }}</td>
                                    <td><span class="badge bg-success">Available</span></td>
                                    <td class="text-end">
                                        <button class="btn btn-sm btn-outline-danger" @click="removeSlot(a)" title="Remove slot">
                                            <i class="bi bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <p class="p-3 text-muted mb-0" v-else>No availability set. Add slots above.</p>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            slots: [],
            doctorId: null,
            saving: false,
            newSlot: { date: window.store.todayStr, start_time: '09:00', end_time: '10:00' }
        };
    },
    async created() {
        await this.loadDoctor();
    },
    methods: {
        async loadDoctor() {
            try {
                const me = await this.store.api('/auth/me');
                if (me.doctor) {
                    this.doctorId = me.doctor.id;
                    await this.loadSlots();
                }
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async loadSlots() {
            if (!this.doctorId) return;
            try {
                this.slots = await this.store.api('/doctors/' + this.doctorId + '/availability');
            } catch (e) { this.store.showAlert(e.message, 'danger'); }
        },
        async addSlot() {
            if (!this.doctorId) {
                this.store.showAlert('Doctor profile not found', 'danger');
                return;
            }
            const s = this.newSlot;
            if (!s.date || !s.start_time || !s.end_time) {
                this.store.showAlert('Please choose a date, start time and end time', 'danger');
                return;
            }
            if (s.end_time <= s.start_time) {
                this.store.showAlert('End time must be after start time', 'danger');
                return;
            }
            this.saving = true;
            try {
                await this.store.api('/doctors/' + this.doctorId + '/availability', 'POST', {
                    slots: [{ date: s.date, start_time: s.start_time, end_time: s.end_time, is_available: true }]
                });
                this.store.showAlert('Availability slot added');
                await this.loadSlots();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            } finally {
                this.saving = false;
            }
        },
        async removeSlot(slot) {
            if (!confirm('Remove the ' + slot.start_time + '-' + slot.end_time + ' slot on ' + slot.date + '?')) return;
            try {
                await this.store.api('/doctors/' + this.doctorId + '/availability/' + slot.id, 'DELETE');
                this.store.showAlert('Slot removed');
                await this.loadSlots();
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};

window.BookingModal = {
    emits: ['booked'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">Book Appointment with Dr. {{ doctorName }}</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-danger py-2" v-if="error">{{ error }}</div>
                        <div v-if="availability.length" class="mb-3">
                            <h6>Available slots <small class="text-muted">(click one to fill in the date and time)</small></h6>
                            <div v-for="slot in availability" :key="slot.id"
                                 class="badge me-1 mb-1 p-2 slot-badge"
                                 :class="form.date === slot.date && form.time === slot.start_time ? 'bg-primary' : 'bg-success'"
                                 @click="pickSlot(slot)">
                                {{ slot.date }} | {{ slot.start_time }} - {{ slot.end_time }}
                            </div>
                        </div>
                        <div v-else class="alert alert-warning py-2">
                            Dr. {{ doctorName }} hasn't opened any slots for the next 7 days yet.
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Date *</label>
                                <input type="date" class="form-control" v-model="form.date" :min="store.todayStr" :max="store.weekLaterStr">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label class="form-label">Time *</label>
                                <input type="time" class="form-control" v-model="form.time">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Reason for Visit</label>
                            <textarea class="form-control" v-model="form.reason" rows="3" maxlength="1000"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" @click="book" :disabled="saving || !availability.length">
                            <span v-if="saving" class="spinner-border spinner-border-sm me-1"></span>
                            Book Appointment
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            form: { doctor_id: null, date: '', time: '', reason: '' },
            doctorName: '',
            availability: [],
            error: '',
            saving: false,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        pickSlot(slot) {
            this.form.date = slot.date;
            this.form.time = slot.start_time;
            this.error = '';
        },
        async show(doctor) {
            this.doctorName = doctor.name;
            this.form = { doctor_id: doctor.id, date: '', time: '', reason: '' };
            this.error = '';
            try {
                this.availability = await this.store.api('/doctors/' + doctor.id + '/availability');
            } catch (e) {
                this.availability = [];
            }
            this.bsModal.show();
        },
        async book() {
            this.error = '';
            if (!this.form.date || !this.form.time) {
                this.error = 'Please choose a date and time';
                return;
            }
            this.saving = true;
            try {
                await this.store.api('/appointments', 'POST', this.form);
                this.store.showAlert('Appointment booked successfully!');
                this.bsModal.hide();
                this.$emit('booked');
            } catch (e) {
                this.error = e.message;
            } finally {
                this.saving = false;
            }
        }
    }
};

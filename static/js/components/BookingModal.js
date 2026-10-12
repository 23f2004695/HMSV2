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
                        <div class="mb-3">
                            <label class="form-label">Date *</label>
                            <input type="date" class="form-control" v-model="form.date" :min="store.todayStr">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Time *</label>
                            <input type="time" class="form-control" v-model="form.time">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Reason for Visit</label>
                            <textarea class="form-control" v-model="form.reason" rows="3"></textarea>
                        </div>
                        <div v-if="availability.length" class="mb-3">
                            <h6>Available Slots:</h6>
                            <div v-for="slot in availability" :key="slot.id"
                                 class="badge bg-success me-1 mb-1 p-2" style="cursor:pointer"
                                 @click="form.date = slot.date; form.time = slot.start_time">
                                {{ slot.date }} | {{ slot.start_time }} - {{ slot.end_time }}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" @click="book">Book Appointment</button>
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
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        async show(doctor) {
            this.doctorName = doctor.name;
            this.form = { doctor_id: doctor.id, date: '', time: '', reason: '' };
            try {
                this.availability = await this.store.api('/doctors/' + doctor.id + '/availability');
            } catch (e) {
                this.availability = [];
            }
            this.bsModal.show();
        },
        async book() {
            try {
                await this.store.api('/appointments', 'POST', this.form);
                this.store.showAlert('Appointment booked successfully!');
                this.bsModal.hide();
                this.$emit('booked');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};

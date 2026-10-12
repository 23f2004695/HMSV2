window.RescheduleModal = {
    emits: ['rescheduled'],
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-warning">
                        <h5 class="modal-title">Reschedule Appointment</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">New Date *</label>
                            <input type="date" class="form-control" v-model="form.date" :min="store.todayStr">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">New Time *</label>
                            <input type="time" class="form-control" v-model="form.time">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-warning" @click="reschedule">Reschedule</button>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return {
            store: window.store,
            form: { date: '', time: '' },
            appointmentId: null,
            bsModal: null
        };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        show(appointment) {
            this.appointmentId = appointment.id;
            this.form = { date: '', time: '' };
            this.bsModal.show();
        },
        async reschedule() {
            try {
                await this.store.api('/appointments/' + this.appointmentId, 'PUT', this.form);
                this.store.showAlert('Appointment rescheduled successfully');
                this.bsModal.hide();
                this.$emit('rescheduled');
            } catch (e) {
                this.store.showAlert(e.message, 'danger');
            }
        }
    }
};

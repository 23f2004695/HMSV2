window.TicketModal = {
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content bg-transparent shadow-none">
                    <div class="text-end mb-2">
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <boarding-pass v-if="appointment" :key="appointment.id" :appointment="appointment"></boarding-pass>
                </div>
            </div>
        </div>
    `,
    data() {
        return { appointment: null, bsModal: null };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
        this.$refs.modal.addEventListener('hidden.bs.modal', () => { this.appointment = null; });
    },
    methods: {
        show(appointment) {
            this.appointment = appointment;
            this.bsModal.show();
        }
    }
};

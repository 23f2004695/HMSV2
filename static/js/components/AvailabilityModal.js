window.AvailabilityModal = {
    template: `
        <div class="modal fade" ref="modal" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title">Dr. {{ doctorName }} - Availability</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <table class="table table-sm" v-if="slots.length">
                            <thead><tr><th>Date</th><th>Start</th><th>End</th></tr></thead>
                            <tbody>
                                <tr v-for="a in slots" :key="a.id">
                                    <td>{{ a.date }}</td><td>{{ a.start_time }}</td><td>{{ a.end_time }}</td>
                                </tr>
                            </tbody>
                        </table>
                        <p class="text-muted" v-else>No availability set for the next 7 days.</p>
                    </div>
                </div>
            </div>
        </div>
    `,
    data() {
        return { doctorName: '', slots: [], bsModal: null };
    },
    mounted() {
        this.bsModal = new bootstrap.Modal(this.$refs.modal);
    },
    methods: {
        async show(doctor) {
            this.doctorName = doctor.name;
            try {
                this.slots = await window.store.api('/doctors/' + doctor.id + '/availability');
            } catch (e) {
                this.slots = [];
            }
            this.bsModal.show();
        }
    }
};

window.AlertMessage = {
    template: `
        <div v-if="store.alertMessage" class="alert alert-dismissible" :class="'alert-' + store.alertType" role="alert">
            {{ store.alertMessage }}
            <button type="button" class="btn-close" @click="store.alertMessage = ''"></button>
        </div>
    `,
    setup() {
        return { store: window.store };
    }
};

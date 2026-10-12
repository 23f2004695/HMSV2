window.ToastStack = {
    template: `
        <div class="toast-stack" aria-live="polite">
            <transition-group name="toast">
                <div v-for="t in store.toasts" :key="t.id" class="hms-toast" :style="{ '--toast-color': colors[t.type] || colors.info }" role="status">
                    <i class="toast-icon bi" :class="icons[t.type] || icons.info"></i>
                    <div class="small">{{ t.message }}</div>
                    <button class="toast-close" @click="store.dismissToast(t.id)" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>
                    <span class="toast-timer"></span>
                </div>
            </transition-group>
        </div>
    `,
    data() {
        return {
            store: window.store,
            colors: { success: '#059669', danger: '#e11d48', warning: '#d97706', info: '#2563eb' },
            icons: {
                success: 'bi-check-circle-fill',
                danger: 'bi-exclamation-octagon-fill',
                warning: 'bi-exclamation-triangle-fill',
                info: 'bi-info-circle-fill'
            }
        };
    }
};

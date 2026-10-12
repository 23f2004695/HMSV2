// One heartbeat (P wave, QRS spike, T wave) repeated across the width
function ecgPath(beats) {
    const width = 600;
    const step = width / beats;
    let d = 'M0,30';
    for (let i = 0; i < beats; i++) {
        const x = i * step;
        const s = step / 100;
        d += ` L${x + 30 * s},30 L${x + 36 * s},24 L${x + 42 * s},30 L${x + 52 * s},30` +
             ` L${x + 56 * s},36 L${x + 61 * s},4 L${x + 66 * s},54 L${x + 70 * s},30` +
             ` L${x + 80 * s},30 L${x + 88 * s},21 L${x + 96 * s},30 L${x + 100 * s},30`;
    }
    return d;
}

window.EcgLine = {
    props: {
        beats: { type: Number, default: 4 },
        spike: { type: Boolean, default: false },
        height: { type: Number, default: 40 }
    },
    computed: {
        d() { return ecgPath(this.beats); }
    },
    template: `
        <svg class="ecg" :class="{ spike }" viewBox="0 0 600 60" preserveAspectRatio="none" :style="{ height: height + 'px' }" aria-hidden="true">
            <path class="ecg-ghost" :d="d" pathLength="1000"></path>
            <path class="ecg-trace" :d="d" pathLength="1000"></path>
        </svg>
    `
};

window.EcgLoader = {
    props: { text: { type: String, default: 'Loading...' } },
    template: `
        <div class="ecg-loader" role="status">
            <ecg-line :beats="2" :height="48"></ecg-line>
            <span>{{ text }}</span>
        </div>
    `
};

// 3D character illustrations: they tilt toward the cursor, can float,
// and say something in a speech bubble when clicked.
const ILLO_PATH = '/static/img/illos/';

// One mascot per department, with a tip it says when tapped
window.DEPT_ILLOS = {
    'Cardiology':       { img: 'cardiologist',      tint: '#ffe3e6', tip: 'Chest pain, palpitations or BP? I look after hearts.' },
    'Orthopedics':      { img: 'doctor-cane',       tint: '#fff1d6', tip: 'Bones, joints and sprains. Let’s get you moving again.' },
    'Pediatrics':       { img: 'nurse-wave',        tint: '#e3f6ea', tip: 'Little ones get extra patience (and stickers).' },
    'Dermatology':      { img: 'pharmacist',        tint: '#f2e8ff', tip: 'Rashes, itching, acne or hair loss? Show me.' },
    'Neurology':        { img: 'radiologist',       tint: '#e6ecff', tip: 'Headaches, dizziness, numbness. I read the scans.' },
    'ENT':              { img: 'doctor-magnifier',  tint: '#dff5f4', tip: 'Ears, nose and throat. I’ll take a close look.' },
    'Ophthalmology':    { img: 'doctor-glasses',    tint: '#e2f2ff', tip: 'Blurry vision or sore eyes? Come get them checked.' },
    'General Medicine': { img: 'doctor-standing',   tint: '#eef1f7', tip: 'Not sure where to go? Start with me.' }
};

window.deptIllo = function (name) {
    return window.DEPT_ILLOS[name] || { img: 'doctor-stethoscope', tint: '#eef1f7', tip: 'Happy to help!' };
};

window.Illo = {
    props: {
        name: { type: String, required: true },
        tips: { type: Array, default: () => [] },
        alt: { type: String, default: '' },
        float: { type: Boolean, default: false },
        pop: { type: Boolean, default: false },
        hint: { type: Boolean, default: false },
        tilt: { type: Boolean, default: true },
        // show the tip on hover instead of waiting for a click (used on clickable cards)
        hoverTalk: { type: Boolean, default: false }
    },
    template: `
        <div class="illo" :class="{ floaty: float, pop, jiggle }" role="img" :aria-label="alt || name"
             @mouseenter="hoverTalk && say()" @mousemove="onMove" @mouseleave="reset" @click="speak">
            <transition name="bubble"><div v-if="bubble" class="illo-bubble">{{ bubble }}</div></transition>
            <div class="illo-inner" :style="tiltStyle">
                <img :src="src" :alt="alt || name" draggable="false" @animationend="jiggle = false">
            </div>
            <span v-if="hint && tips.length && !spoken" class="illo-hint" aria-hidden="true"><i class="bi bi-chat-dots-fill"></i></span>
        </div>
    `,
    data() {
        return { rx: 0, ry: 0, hovering: false, bubble: '', tipIndex: 0, jiggle: false, spoken: false, timer: null };
    },
    computed: {
        src() {
            return ILLO_PATH + this.name + '.webp';
        },
        tiltStyle() {
            if (!this.hovering) return {};
            return { transform: `rotateX(${this.rx}deg) rotateY(${this.ry}deg) scale(1.05)` };
        }
    },
    unmounted() {
        clearTimeout(this.timer);
    },
    methods: {
        onMove(e) {
            if (!this.tilt || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
            const r = this.$el.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            this.hovering = true;
            this.ry = x * 18;
            this.rx = -y * 14;
        },
        reset() {
            this.hovering = false;
            if (this.hoverTalk) this.bubble = '';
        },
        speak() {
            this.jiggle = false;
            this.$nextTick(() => { this.jiggle = true; });
            this.say();
        },
        say() {
            if (!this.tips.length) return;
            this.spoken = true;
            this.bubble = this.tips[this.tipIndex % this.tips.length];
            this.tipIndex++;
            clearTimeout(this.timer);
            this.timer = setTimeout(() => { this.bubble = ''; }, 3500);
        }
    }
};

window.AppLoader = {
    props: { text: { type: String, default: 'Loading' } },
    template: `
        <div class="app-loader" role="status">
            <img src="/static/img/illos/pill-lift.webp" alt="">
            <span>{{ text }}<span class="dots"><span>.</span><span>.</span><span>.</span></span></span>
        </div>
    `
};

window.EmptyState = {
    props: {
        illo: { type: String, default: 'nurse-wave' },
        title: { type: String, default: '' },
        text: { type: String, default: '' },
        tips: { type: Array, default: () => [] }
    },
    template: `
        <div class="empty-state">
            <illo :name="illo" :tips="tips" float pop></illo>
            <h6 v-if="title">{{ title }}</h6>
            <div v-if="text" class="small">{{ text }}</div>
            <div v-if="$slots.default" class="mt-3"><slot></slot></div>
        </div>
    `
};

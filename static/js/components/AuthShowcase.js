// Left side of the login screen: characters taking turns to show what the app does
window.AuthShowcase = {
    template: `
        <div class="auth-art" @mouseenter="paused = true" @mouseleave="paused = false">
            <div class="brand"><span class="brand-heart"><i class="bi bi-heart-pulse-fill"></i></span> HMS</div>
            <h1>Your hospital visit,<br>without the waiting-room guesswork.</h1>
            <p class="lead mt-3">Book a doctor in a few taps, follow your place in the queue, and keep every prescription in one place.</p>
            <div class="auth-stage">
                <div class="stage-floor"></div>
                <transition name="stage">
                    <illo :key="slide.img" :name="slide.img" :tips="[slide.tip]" float></illo>
                </transition>
            </div>
            <div class="auth-caption">
                <transition name="page" mode="out-in"><div :key="index">{{ slide.caption }}</div></transition>
            </div>
            <div class="auth-dots">
                <button v-for="(s, i) in slides" :key="i" :class="{ active: i === index }" @click="go(i)" :aria-label="'Show ' + s.caption"></button>
            </div>
        </div>
    `,
    data() {
        return {
            index: 0,
            paused: false,
            timer: null,
            slides: [
                { img: 'clipboard-scene', caption: 'Tap where it hurts and we suggest the right doctor.', tip: 'Knee pain? That’s Orthopedics.' },
                { img: 'nurse-wave', caption: 'Your ticket shows your place in the queue, live.', tip: 'I’ll call your token when it’s your turn!' },
                { img: 'ward-scene', caption: 'Doctors run their day from one simple queue.', tip: 'Next patient, please!' },
                { img: 'heart-hug', caption: 'Every diagnosis and prescription, kept for you.', tip: 'Your whole health journey in one place.' }
            ]
        };
    },
    computed: {
        slide() { return this.slides[this.index]; }
    },
    mounted() {
        this.timer = setInterval(() => { if (!this.paused) this.index = (this.index + 1) % this.slides.length; }, 4500);
    },
    unmounted() {
        clearInterval(this.timer);
    },
    methods: {
        go(i) { this.index = i; }
    }
};

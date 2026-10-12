// "Where does it hurt?" Tap a body region, pick a symptom, get pointed at the right department.
const BODY_REGIONS = {
    head:    { label: 'Head', symptoms: [
        { text: 'Headache or migraine', dept: 'Neurology' },
        { text: 'Dizziness or fainting', dept: 'Neurology' },
        { text: 'Fever', dept: 'General Medicine' },
        { text: 'Hair loss or scalp itch', dept: 'Dermatology' }] },
    eyes:    { label: 'Eyes', symptoms: [
        { text: 'Blurry vision', dept: 'Ophthalmology' },
        { text: 'Red, itchy or watery eyes', dept: 'Ophthalmology' },
        { text: 'Eye pain', dept: 'Ophthalmology' }] },
    throat:  { label: 'Ear, nose & throat', symptoms: [
        { text: 'Sore throat', dept: 'ENT' },
        { text: 'Ear pain or blocked ear', dept: 'ENT' },
        { text: 'Blocked or runny nose', dept: 'ENT' }] },
    chest:   { label: 'Chest', symptoms: [
        { text: 'Chest pain or tightness', dept: 'Cardiology' },
        { text: 'Racing or irregular heartbeat', dept: 'Cardiology' },
        { text: 'Short of breath', dept: 'Cardiology' },
        { text: 'Cough or cold', dept: 'General Medicine' }] },
    stomach: { label: 'Stomach', symptoms: [
        { text: 'Stomach ache', dept: 'General Medicine' },
        { text: 'Acidity or indigestion', dept: 'General Medicine' },
        { text: 'Nausea or vomiting', dept: 'General Medicine' }] },
    arms:    { label: 'Arms & hands', symptoms: [
        { text: 'Joint pain or swelling', dept: 'Orthopedics' },
        { text: 'Fracture or sprain', dept: 'Orthopedics' },
        { text: 'Numbness or tingling', dept: 'Neurology' },
        { text: 'Rash or skin patches', dept: 'Dermatology' }] },
    legs:    { label: 'Legs & feet', symptoms: [
        { text: 'Knee or hip pain', dept: 'Orthopedics' },
        { text: 'Sprain or injury', dept: 'Orthopedics' },
        { text: 'Swollen ankles', dept: 'Cardiology' },
        { text: 'Rash or skin patches', dept: 'Dermatology' }] }
};

window.BodyMap = {
    emits: ['pick'],
    template: `
        <div class="row g-4 align-items-center body-map">
            <div class="col-md-5 text-center">
                <svg viewBox="0 0 200 420" class="body-svg" role="group" aria-label="Body map">
                    <defs>
                        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stop-color="var(--body-fill-top)"></stop>
                            <stop offset="1" stop-color="var(--body-fill-bottom)"></stop>
                        </linearGradient>
                    </defs>
                    <g v-for="part in parts" :key="part.id" class="body-part"
                       :class="{ selected: region === part.region, hovered: hover === part.region }"
                       tabindex="0" role="button" :aria-label="regions[part.region].label"
                       @mouseenter="hover = part.region" @mouseleave="hover = ''"
                       @click="select(part.region)" @keydown.enter="select(part.region)">
                        <component :is="part.tag" v-bind="part.attrs"></component>
                    </g>
                    <circle v-if="pin" class="pin-ring" :cx="pin.x" :cy="pin.y" r="10"></circle>
                    <circle v-if="pin" class="pin-dot" :cx="pin.x" :cy="pin.y" r="4"></circle>
                </svg>
                <div class="small text-muted mt-2">{{ hover ? regions[hover].label : 'Tap where it hurts' }}</div>
            </div>
            <div class="col-md-7" ref="panel">
                <transition name="page" mode="out-in">
                    <div v-if="!region" key="intro" class="text-md-start text-center">
                        <h4 class="fw-bold">Where does it hurt?</h4>
                        <p class="text-muted">Tap the part of the body that's bothering you. We'll suggest the right department and show you who's free.</p>
                        <div class="form-check form-switch d-inline-block mb-3">
                            <input class="form-check-input" type="checkbox" id="forChild" v-model="forChild">
                            <label class="form-check-label" for="forChild">This is for a child</label>
                        </div>
                        <div class="d-flex flex-wrap gap-2 justify-content-center justify-content-md-start">
                            <button v-for="(r, key) in regions" :key="key" class="btn btn-sm btn-outline-secondary rounded-pill" @click="select(key)">{{ r.label }}</button>
                        </div>
                    </div>
                    <div v-else :key="region">
                        <button class="btn btn-link px-0 mb-2" @click="reset"><i class="bi bi-arrow-left"></i> Pick another area</button>
                        <h4 class="fw-bold">{{ regions[region].label }}: what's going on?</h4>
                        <div class="d-flex flex-wrap gap-2 my-3 stagger">
                            <button v-for="s in regions[region].symptoms" :key="s.text" class="symptom-chip"
                                    :class="{ selected: symptom && symptom.text === s.text }" @click="choose(s)">
                                {{ s.text }}
                            </button>
                        </div>
                        <div class="form-check form-switch mb-2">
                            <input class="form-check-input" type="checkbox" id="forChild2" v-model="forChild">
                            <label class="form-check-label" for="forChild2">This is for a child</label>
                        </div>
                        <transition name="page">
                            <div v-if="suggestion" class="suggestion">
                                <div class="small text-muted">We suggest</div>
                                <div class="fs-4 fw-bold">{{ suggestion }}</div>
                                <div class="small text-muted">{{ forChild && suggestion === 'Pediatrics' ? 'Children are seen by our paediatricians first.' : 'Based on: ' + symptom.text.toLowerCase() }}</div>
                            </div>
                        </transition>
                    </div>
                </transition>
            </div>
        </div>
    `,
    data() {
        return { regions: BODY_REGIONS, region: '', hover: '', symptom: null, forChild: false, pin: null };
    },
    computed: {
        parts() {
            const r = (x, y, w, h, rx, extra = {}) => ({ tag: 'rect', attrs: { x, y, width: w, height: h, rx, ...extra } });
            return [
                { id: 'arm-l', region: 'arms', pin: { x: 40, y: 160 }, ...r(28, 100, 24, 118, 12, { transform: 'rotate(8 40 100)' }) },
                { id: 'arm-r', region: 'arms', pin: { x: 160, y: 160 }, ...r(148, 100, 24, 118, 12, { transform: 'rotate(-8 160 100)' }) },
                { id: 'leg-l', region: 'legs', pin: { x: 83, y: 300 }, ...r(70, 222, 27, 168, 13) },
                { id: 'leg-r', region: 'legs', pin: { x: 117, y: 300 }, ...r(103, 222, 27, 168, 13) },
                { id: 'stomach', region: 'stomach', pin: { x: 100, y: 190 }, ...r(64, 160, 72, 64, 18) },
                { id: 'chest', region: 'chest', pin: { x: 100, y: 125 }, ...r(58, 92, 84, 72, 22) },
                { id: 'neck', region: 'throat', pin: { x: 100, y: 82 }, ...r(88, 70, 24, 26, 8) },
                { id: 'head', region: 'head', pin: { x: 100, y: 28 }, tag: 'circle', attrs: { cx: 100, cy: 42, r: 30 } },
                { id: 'eye-l', region: 'eyes', pin: { x: 100, y: 42 }, tag: 'ellipse', attrs: { cx: 89, cy: 42, rx: 6, ry: 4.5 } },
                { id: 'eye-r', region: 'eyes', pin: { x: 100, y: 42 }, tag: 'ellipse', attrs: { cx: 111, cy: 42, rx: 6, ry: 4.5 } }
            ];
        },
        suggestion() {
            if (!this.symptom) return '';
            return this.forChild ? 'Pediatrics' : this.symptom.dept;
        }
    },
    watch: {
        suggestion(dept) {
            if (dept) this.$emit('pick', { department: dept, symptom: this.symptom.text, region: this.regions[this.region].label });
        }
    },
    methods: {
        select(region) {
            this.region = region;
            this.symptom = null;
            const part = this.parts.find(p => p.region === region);
            this.pin = part ? part.pin : null;
            // on phones the symptoms sit below the figure, so bring them into view
            if (window.innerWidth < 768) {
                this.$nextTick(() => setTimeout(() => this.$refs.panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 250));
            }
        },
        choose(s) {
            this.symptom = s;
        },
        reset() {
            this.region = '';
            this.symptom = null;
            this.pin = null;
            this.$emit('pick', null);
        }
    }
};

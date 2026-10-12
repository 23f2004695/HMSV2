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

// Where each region sits on the patient-cheer illustration, in % of its width/height
const HOTSPOTS = [
    { region: 'head', x: 52, y: 9, label: 'Head' },
    { region: 'eyes', x: 52, y: 21, label: 'Eyes' },
    { region: 'throat', x: 51, y: 35, label: 'Ear, nose & throat' },
    { region: 'chest', x: 50, y: 46, label: 'Chest' },
    { region: 'stomach', x: 50, y: 58, label: 'Stomach' },
    { region: 'arms', x: 17, y: 33, label: 'Arms & hands' },
    { region: 'arms', x: 84, y: 32, label: 'Arms & hands' },
    { region: 'legs', x: 29, y: 74, label: 'Legs & feet' },
    { region: 'legs', x: 71, y: 74, label: 'Legs & feet' }
];

window.BodyMap = {
    emits: ['pick'],
    template: `
        <div class="row g-4 align-items-center body-map">
            <div class="col-md-5 text-center">
                <div class="body-figure" :class="{ picked: region }">
                    <img src="/static/img/illos/patient-cheer.webp" alt="A patient. Tap the part of the body that hurts." draggable="false">
                    <button v-for="(h, i) in hotspots" :key="i" type="button" class="hotspot" :class="{ active: region === h.region }"
                            :style="{ left: h.x + '%', top: h.y + '%', '--delay': (i * 0.25) + 's' }"
                            :aria-label="h.label" @click="select(h.region)">
                        <span class="hotspot-label">{{ h.label }}</span>
                    </button>
                </div>
                <div class="small text-muted mt-2 fw-semibold">Tap a dot where it hurts</div>
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
                            <button v-for="(r, key) in regions" :key="key" class="symptom-chip" @click="select(key)">{{ r.label }}</button>
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
                        <transition name="page" mode="out-in">
                            <div v-if="suggestion" :key="suggestion" class="suggestion">
                                <illo :name="deptIllo(suggestion).img" :tips="[deptIllo(suggestion).tip]" pop></illo>
                                <div>
                                    <div class="small text-muted fw-semibold">We suggest</div>
                                    <div class="fs-4 fw-bold">{{ suggestion }}</div>
                                    <div class="small text-muted">{{ forChild && suggestion === 'Pediatrics' ? 'Children are seen by our paediatric team first.' : 'Based on: ' + symptom.text.toLowerCase() }}</div>
                                </div>
                            </div>
                        </transition>
                    </div>
                </transition>
            </div>
        </div>
    `,
    data() {
        return { regions: BODY_REGIONS, hotspots: HOTSPOTS, region: '', symptom: null, forChild: false };
    },
    computed: {
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
        deptIllo(name) {
            return window.deptIllo(name);
        },
        select(region) {
            this.region = region;
            this.symptom = null;
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
            this.$emit('pick', null);
        }
    }
};

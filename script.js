document.addEventListener("DOMContentLoaded", () => {
    const track = document.querySelector(".carousel-track");
    const slides = [...document.querySelectorAll(".carousel-track .slide")];
    const indicators = [...document.querySelectorAll(".carousel-indicators .indicator")];
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const MIN_SLIDE_TIME = 7500;
    const MAX_SLIDE_TIME = 14000;
    let current = 0;
    let timer = null;

    const AMBIENT_FPS = 15;
    const AMBIENT_WIDTH = 64;
    const AMBIENT_PAD = 76;
    let ambientTimer = null;

    const ambient = slides.map(slide => {
        const canvas = slide.querySelector("canvas.video-backdrop");
        if (!canvas) return null;
        const video = slide.querySelector("video");
        const poster = new Image();
        poster.src = canvas.dataset.poster || (video && video.poster) || "";
        const item = { slide, canvas, ctx: canvas.getContext("2d"), video, poster };
        poster.addEventListener("load", () => paintAmbient(item));
        return item;
    });

    function sizeAmbient(item) {
        const w = item.slide.clientWidth + AMBIENT_PAD;
        const h = item.slide.clientHeight + AMBIENT_PAD;
        item.canvas.width = AMBIENT_WIDTH;
        item.canvas.height = Math.max(1, Math.round(AMBIENT_WIDTH * h / w));
    }

    function drawCover(item, source, sw, sh) {
        const cw = item.canvas.width;
        const ch = item.canvas.height;
        const scale = Math.max(cw / sw, ch / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        item.ctx.drawImage(source, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }

    function paintAmbient(item) {
        if (!item) return;
        const v = item.video;
        if (v && v.readyState >= 2 && v.videoWidth) {
            drawCover(item, v, v.videoWidth, v.videoHeight);
        } else if (item.poster.complete && item.poster.naturalWidth) {
            drawCover(item, item.poster, item.poster.naturalWidth, item.poster.naturalHeight);
        }
    }

    function stopAmbient() {
        window.clearInterval(ambientTimer);
        ambientTimer = null;
    }

    function startAmbient() {
        stopAmbient();
        if (reduceMotion || document.hidden) return;
        ambientTimer = window.setInterval(() => paintAmbient(ambient[current]), 1000 / AMBIENT_FPS);
    }

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(() => {
            ambient.forEach(item => { if (item) { sizeAmbient(item); paintAmbient(item); } });
        }, 150);
    });

    ambient.forEach(item => { if (item) sizeAmbient(item); });

    function activate(slide, shouldPlay) {
        slide.querySelectorAll("video").forEach(video => {
            if (shouldPlay) {
                const playPromise = video.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => {});
                }
            } else {
                video.pause();
            }
        });

        const frame = slide.querySelector("iframe[data-src]");
        if (frame) {
            frame.src = shouldPlay ? frame.dataset.src : "about:blank";
        }
    }

    function goTo(index) {
        if (!track || slides.length === 0) return;

        current = (index + slides.length) % slides.length;

        slides.forEach((slide, slideIndex) => {
            const isActive = slideIndex === current;
            slide.classList.toggle("is-active", isActive);
            activate(slide, isActive && !document.hidden);
        });

        paintAmbient(ambient[current]);

        indicators.forEach(button => {
            const isActive = Number(button.dataset.index) === current;
            button.classList.toggle("active", isActive);
            button.setAttribute("aria-current", isActive ? "true" : "false");
        });
    }

    function scheduleNextSlide() {
        window.clearTimeout(timer);
        if (reduceMotion || slides.length < 2 || document.hidden) return;

        const randomDelay = Math.floor(
            MIN_SLIDE_TIME + Math.random() * (MAX_SLIDE_TIME - MIN_SLIDE_TIME + 1)
        );

        timer = window.setTimeout(() => {
            goTo(current + 1);
            scheduleNextSlide();
        }, randomDelay);
    }

    indicators.forEach(button => {
        button.addEventListener("click", () => {
            const targetIndex = Number(button.dataset.index);
            if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= slides.length) return;

            goTo(targetIndex);
            scheduleNextSlide();
        });
    });

    if (track && slides.length > 0) {
        goTo(0);
        scheduleNextSlide();
        startAmbient();
    }

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            window.clearTimeout(timer);
            stopAmbient();
            if (slides[current]) activate(slides[current], false);
        } else if (slides[current]) {
            activate(slides[current], true);
            scheduleNextSlide();
            startAmbient();
        }
    });

    document.querySelectorAll("[data-home]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
            history.replaceState(null, "", window.location.pathname);
        });
    });

    const navbar = document.querySelector(".navbar");
    const links = document.querySelectorAll(".nav-links a");
    const projectsCard = document.getElementById("projects");
    const navH = () => parseInt(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 68;

    const setActive = id => {
        links.forEach(link => link.classList.toggle("active", link.dataset.section === id));
    };

    const onScroll = () => {
        if (navbar) navbar.classList.toggle("scrolled", window.scrollY > 10);
        if (!projectsCard) return;
        const top = projectsCard.getBoundingClientRect().top;
        setActive(window.scrollY < 40 || top > navH() + 60 ? "home" : "projects");
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
});
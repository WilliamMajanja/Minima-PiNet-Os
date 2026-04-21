/**
 * PiNet-OS Window Manager — Python Frontend
 * Handles window creation, dragging, resizing, minimize, maximize, close.
 */
const WindowManager = {
    windows: {},
    nextZ: 100,
    cascadeIndex: 0,

    TOPBAR_H: 40,
    TASKBAR_H: 64,
    DEFAULT_W: 900,
    DEFAULT_H: 560,
    MIN_W: 420,
    MIN_H: 260,
    CASCADE_STEP: 30,

    open(appId, title, contentHtml, options = {}) {
        if (this.windows[appId]) {
            this.focus(appId);
            if (this.windows[appId].minimized) this.toggleMinimize(appId);
            return;
        }

        const pos = this._cascadePos();
        const w = options.width || this.DEFAULT_W;
        const h = options.height || this.DEFAULT_H;

        const win = document.createElement('div');
        win.className = 'window active';
        win.id = `win-${appId}`;
        win.style.cssText = `left:${pos.x}px;top:${pos.y}px;width:${w}px;height:${h}px;z-index:${this.nextZ++}`;

        win.innerHTML = `
            <div class="window-titlebar" data-app="${appId}">
                <span class="window-title">${this._escapeHtml(title)}</span>
                <div class="window-controls">
                    <button class="window-btn minimize" data-action="minimize" data-app="${appId}"></button>
                    <button class="window-btn maximize" data-action="maximize" data-app="${appId}"></button>
                    <button class="window-btn close" data-action="close" data-app="${appId}"></button>
                </div>
            </div>
            <div class="window-content" id="content-${appId}">${contentHtml}</div>
            <div class="window-resize" data-app="${appId}"></div>
        `;

        document.getElementById('windows-layer').appendChild(win);

        this.windows[appId] = {
            el: win, title, minimized: false, maximized: false,
            x: pos.x, y: pos.y, w, h, options,
        };

        this._setupDrag(win, appId);
        this._setupResize(win, appId);
        this._setupControls(win, appId);
        this.focus(appId);
        this._updateTaskbar();
        this.cascadeIndex++;

        // Call app-specific init if provided
        if (options.onInit) {
            setTimeout(() => options.onInit(appId), 50);
        }
    },

    close(appId) {
        const state = this.windows[appId];
        if (!state) return;
        if (state.options && state.options.onClose) state.options.onClose(appId);
        state.el.remove();
        delete this.windows[appId];
        this._updateTaskbar();
    },

    focus(appId) {
        const state = this.windows[appId];
        if (!state) return;
        Object.values(this.windows).forEach(w => w.el.classList.remove('active'));
        state.el.style.zIndex = this.nextZ++;
        state.el.classList.add('active');
        this._updateTaskbar();
    },

    toggleMinimize(appId) {
        const state = this.windows[appId];
        if (!state) return;
        state.minimized = !state.minimized;
        state.el.classList.toggle('minimized', state.minimized);
        if (!state.minimized) this.focus(appId);
        this._updateTaskbar();
    },

    toggleMaximize(appId) {
        const state = this.windows[appId];
        if (!state) return;
        state.maximized = !state.maximized;
        if (state.maximized) {
            state._prevStyle = { left: state.el.style.left, top: state.el.style.top, width: state.el.style.width, height: state.el.style.height };
            state.el.classList.add('maximized');
        } else {
            state.el.classList.remove('maximized');
            if (state._prevStyle) {
                Object.assign(state.el.style, state._prevStyle);
            }
        }
    },

    _cascadePos() {
        const maxX = Math.max(0, window.innerWidth - this.DEFAULT_W - 40);
        const maxY = Math.max(0, window.innerHeight - this.DEFAULT_H - this.TOPBAR_H - this.TASKBAR_H);
        return {
            x: Math.min(80 + this.cascadeIndex * this.CASCADE_STEP, maxX),
            y: Math.min(this.TOPBAR_H + 20 + this.cascadeIndex * this.CASCADE_STEP, maxY + this.TOPBAR_H),
        };
    },

    _setupDrag(win, appId) {
        const titlebar = win.querySelector('.window-titlebar');
        let startX, startY, origX, origY;
        const onMouseMove = (e) => {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newY = Math.max(this.TOPBAR_H, origY + dy);
            win.style.left = (origX + dx) + 'px';
            win.style.top = newY + 'px';
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        titlebar.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('window-btn')) return;
            if (this.windows[appId].maximized) return;
            this.focus(appId);
            startX = e.clientX; startY = e.clientY;
            origX = parseInt(win.style.left) || 0;
            origY = parseInt(win.style.top) || 0;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    },

    _setupResize(win, appId) {
        const handle = win.querySelector('.window-resize');
        let startX, startY, startW, startH;
        const onMouseMove = (e) => {
            const w = Math.max(this.MIN_W, startW + e.clientX - startX);
            const h = Math.max(this.MIN_H, startH + e.clientY - startY);
            win.style.width = w + 'px';
            win.style.height = h + 'px';
        };
        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        handle.addEventListener('mousedown', (e) => {
            if (this.windows[appId].maximized) return;
            this.focus(appId);
            startX = e.clientX; startY = e.clientY;
            startW = win.offsetWidth; startH = win.offsetHeight;
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    },

    _setupControls(win, appId) {
        win.querySelectorAll('.window-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                if (action === 'close') this.close(appId);
                else if (action === 'minimize') this.toggleMinimize(appId);
                else if (action === 'maximize') this.toggleMaximize(appId);
            });
        });
        win.addEventListener('mousedown', () => this.focus(appId));
    },

    _updateTaskbar() {
        const container = document.getElementById('taskbar-items');
        container.innerHTML = '';
        for (const [appId, state] of Object.entries(this.windows)) {
            const item = document.createElement('div');
            item.className = `taskbar-item${state.el.classList.contains('active') ? ' active' : ''}`;
            item.title = state.title;
            const appDef = PiNetApps.getApp(appId);
            item.innerHTML = `
                <div class="icon-circle" style="background:${appDef ? appDef.color : '#475569'}">${appDef ? appDef.icon : '📦'}</div>
                ${!state.minimized ? '<div class="dot"></div>' : ''}
            `;
            item.addEventListener('click', () => {
                if (state.minimized) this.toggleMinimize(appId);
                else this.focus(appId);
            });
            container.appendChild(item);
        }
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

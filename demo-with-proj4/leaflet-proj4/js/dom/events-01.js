//define is single function for AMD arg:string name[optional],array dependancies[optional], factory (if no preparation then just pass object)
// define (name,[],factory)
define({
    addEvent: function (el, evt, fn) {
        if (el.addEventListener) {
            this.addEvent = function (el, evt, fn) {
                el.addEventListener(evt, fn, false);
                return el;
            };
        } else if (el.attachEvent) {
            this.addEvent = function (el, evt, fn) {
                el.attachEvent("on" + evt, fn);
                return el;
            };
        } else {
            this.addEvent = function (el, evt, fn) {
                el["on" + evt] = fn;
                return el;
            };
        }
        return this.addEvent(el, evt, fn);
    },
    removeEvent: function (el, evt, fn) {
        if (el.removeEventListener) {
            this.removeEvent = function (el, evt, fn) {
                el.removeEventListener(evt, fn, false);
                return el;
            };
        } else if (el.detachEvent) {
            this.removeEvent = function (el, evt, fn) {
                el.removeEvent("on" + evt, fn);
                return el;
            };
        } else {
            this.removeEvent = function (el, evt, fn) {
                el["on" + evt] = fn;
                return el;
            };
        }
        return this.removeEvent(el, evt, fn);
    }
});

import { Subject } from './Subject.js';
export function onDestroyed(widget) {
    const subject = new Subject(void 0);
    widget.connect('destroy', () => {
        subject.next();
        subject.complete();
    });
    return subject;
}

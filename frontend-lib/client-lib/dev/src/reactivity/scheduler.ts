import ReactiveObject from "./reactive";

const queue: Set<ReactiveObject> = new Set();
let isPending = false;

function flushQueue() {
    while (queue.size > 0) {
        const list = Array.from(queue);
        queue.clear();
        list.forEach(r => r.run());
    }
    isPending = false;
}

export function queueReactive(r: ReactiveObject) {
    queue.add(r);
    if (!isPending) {
        isPending = true;
        Promise.resolve().then(flushQueue);
    }
}

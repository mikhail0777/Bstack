// MAP PAGES TO HTML FILES

const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { exec } = require('child_process');

const METHODS = {
    GET: {},
    POST: {},
    PUT: {},
    DELETE: {},
    PATCH: {}
};

const DIST_FOLDER = 'dist\\';
const SRC_FOLDER = 'src\\frontend\\pages-build\\';

const PRINT_ERR = true;

const loadPages = (dir = SRC_FOLDER) => {
    const ddir = dir.replace(SRC_FOLDER, DIST_FOLDER);
    if (!fs.existsSync(ddir)) {
        fs.mkdirSync(ddir);
    }

    fs.readdirSync(dir).forEach(fname => {
        const rpath = path.join(dir, fname);
        if (fs.statSync(rpath).isDirectory()) {
            loadPages(rpath);
        } else {
            loadPage(rpath);
        }
    });
};

const loadPage = (rpath) => {
    if (rpath.includes("client.mjs")) {
        loadClientJS(rpath);
        return;
    }
    if (rpath.includes("server.cjs")) {
        loadServerHTML(rpath);
        return;
    }
    loadOtherFile(rpath);
};

const addPage = (route, content, mime) => {
    route = route.replaceAll('\\', '/');
    METHODS.GET[route] = {
        fn: () => ({
            status: 200,
            data: content
        }),
        mime
    };
};

const loadOtherFile = (path) => {
    const origin = path.replace(SRC_FOLDER, "");
    const target = origin;

    console.log("copy:\t", SRC_FOLDER + origin, "\t=>", DIST_FOLDER + target);
    fs.copyFileSync(
        SRC_FOLDER + origin,
        DIST_FOLDER + target
    );

    const content = fs.readFileSync(SRC_FOLDER + target).toString();
    addPage(target, content, mime.getType(target));
};

const loadClientJS = (path) => {
    const origin = path.replace(SRC_FOLDER, "");
    const target = origin.replace("client.mjs", "bundle.js");

    console.log("rollup:\t", SRC_FOLDER + origin, "\t=>", DIST_FOLDER + target);
    exec(
        `rollup -c -f es -i ${SRC_FOLDER + origin} -o ${DIST_FOLDER + target}`,
        (err, _, stderr) => { if (PRINT_ERR && !!err) console.error(stderr); }
    );

    const content = fs.readFileSync(DIST_FOLDER + target).toString();
    addPage(target, content, mime.getType(target));
};

const loadServerHTML = (p) => {
    const origin = p.replace(SRC_FOLDER, "");
    const target = origin.replace("server.cjs", "index.html");

    console.log("ssr/ssg:\t", SRC_FOLDER + origin, "\t=>", DIST_FOLDER + target);
    
    // SSG step: write index.html to dist for deployment/benchmarking
    const IndexComponent = require(path.resolve(p));
    const content = new IndexComponent()._render();
    fs.writeFileSync(DIST_FOLDER + target, content, console.log);
    
    // Dynamic SSR routing
    let route = origin.replace("server.cjs", "");
    route = route.replaceAll('\\', '/');
    
    METHODS.GET[route] = {
        fn: (req) => {
            if (process.env.NODE_ENV === 'development') {
                delete require.cache[require.resolve(path.resolve(p))];
            }
            const DynamicComponent = require(path.resolve(p));
            const props = { query: req.query || {} };
            const pageContent = new DynamicComponent(props)._render();
            return {
                status: 200,
                data: pageContent
            };
        },
        mime: 'text/html'
    };
};

module.exports = {
    METHODS,
    loadPages
};
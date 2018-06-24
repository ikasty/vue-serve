const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const util  = require('util');
const debug = require('debug')('vue-serve');

const attach_dir = path.resolve(process.argv[2]);
if (!fs.statSync(attach_dir).isDirectory()) {
  console.error("attach path is not a directory");
  process.exit(1);
}

var hash = new Map();

const resolveFile = base => new Promise((resolve, reject) => {
  const trial = ['index.html'];
  const stats = fs.statSync(base);

  let resolvePath = '';

  if (stats.isDirectory()) {
    for (const file of trial) {
      const newpath = path.join(base, file);
      if (fs.statSync(newpath).isFile()) {
        resolvePath = newpath;
        break;
      }
    }
  } else if (stats.isFile()) {
    resolvePath = base;
  }
  if (resolvePath === '') return reject(new Error(`cannot find path ${base}`));

  resolve(resolvePath);
});

const getMime = async file => {
  const ext = path.extname(file);
  switch (ext) {
    case ".js":
      return "application/javascript";
    case ".json": case ".map":
      return "application/json";
    case ".html":
      return "text/html";
    case ".css":
      return "text/css";
    case ".png":
      return "image/png";
    case ".jpeg": case ".jpe": case ".jpg":
      return "image/jpeg";
    case ".svg": case ".svgz":
      return "image/svg+xml";
    case ".gif":
      return "image/gif";

    default:
      return "text/plain";
  }
};

const server = http.createServer();

server.on('request', async (req, res) => {
  const { url } = req;
  const filepath = path.join(attach_dir, url);
  debug(`request on path ${url} => ${filepath}`);

  const gzip = async file => {
    const encoding = req.headers['accept-encoding'];
    const gzip = Boolean(encoding && /gzip/i.test(encoding));
    try {
      if (gzip && fs.statSync(file + '.gz').isFile()) {
        file += '.gz';
        debug(`found gzip compressed file ${file}`);
      }
    } catch (e) { /*noop*/ }

    return file;
  };

  const fileserve = file => {
    debug(`respond with ${file.name} with mime ${file.mime}`);
    res.setHeader('Content-Type', file.mime);
    fs.createReadStream(file.name).pipe(res);
  };

  try {
    let target = hash.get(filepath);
    if (target === false) throw new Error(`cannot find path ${filepath}`);
    if (target === undefined) {
      let name = await resolveFile(filepath);
      let mime = await getMime(name);
      name = await gzip(name);
      target = { name, mime };
      hash.set(filepath, target);
    }

    fileserve(target);
  } catch (e) {
    hash.set(filepath, false);
    debug(e);
    res.writeHead(302, {'Location': '/'});
    res.end();
  }
});

server.listen(3000);
debug("ready to listen in localhost:3000");

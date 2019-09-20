var qs = require('querystring');
var P = require('quick-pomelo').Promise;
var _ = require('lodash');
var http = require('http');

/**
 * http请求
 * @param opts http请求参数{hostname:hn,path:path,port:80,method:'get'}
 * @return 返回请求后的结果
 */
exports.requestAsync = P.promisify(function (opts, cb) {
    var options = _.clone(opts);
    if (opts.data_obj) {
        delete options.data_obj;
    }
    var req = http.request(options, (res) => {
        var text = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            text += chunk;
        });
        res.on('end', () => {
            cb(null, JSON.parse(text));
        });
    });

    req.on('error', (e) => {
        cb(null, { ret: 2, msg: e });
    });
    if (opts.data_obj) req.write(qs.stringify(opts.data_obj));
    req.end();
});
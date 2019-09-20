var _ = require('lodash');
var fs = require('fs');
var crypto = require('crypto');
var path = require('path');
var md5 = require('md5');

var dirname = path.dirname(module.filename);

const rsa_private_key = fs.readFileSync(dirname + '/rsa_private_key.pem');
const rsa_public_key = fs.readFileSync(dirname + '/rsa_public_key.pem');

/**
 * 签名对象排序和返回签名用字符串
 * @param 需要排序的签名对象
 * @return signStr
 */
var sortArrAndReturnStr = function (dataObj) {
    var sortKeys = Object.keys(dataObj);
    sortKeys = _.sortBy(sortKeys);
    var signArr = [];
    for (var i = 0; i < sortKeys.length; i++) {
        signArr.push(sortKeys[i] + '=' + dataObj[sortKeys[i]]);
    }
    return signArr.join('&');
};

exports.sortArrAndReturnStr = sortArrAndReturnStr;

/**
 * rsa 签名
 * @param dataStr 签名用数据对象或字符串
 * @return base64
 */
exports.getRsaSign = function (dataStr) {
    if (typeof dataStr == 'object') {
        dataStr = sortArrAndReturnStr(dataStr);
    }
    var sign = crypto.createSign('RSA-SHA1');
    sign.update(dataStr,'utf8');
    return sign.sign(rsa_private_key, 'base64');
};

/**
 * rsa 签名验证
 * @param dataStr 验证用数据对象或字符串
 * @param signStr 验证用签名字符串（base64）
 * @return boolen
 */
exports.rsaVerify = function (dataStr, signStr) {
    if (typeof dataStr == 'object') {
        dataStr = sortArrAndReturnStr(dataStr);
    }
    var verify = crypto.createVerify('RSA-SHA1');
    verify.update(dataStr, 'utf8');
    return verify.verify(rsa_public_key, signStr, 'base64');
};

/**
 * md5 签名
 * @param data 签名用数据对象
 * @param partnerKey 签名用商户私钥
 * @return md5SignStr
 */
exports.md5Sign = function (data, partnerKey) {
    partnerKey = partnerKey || 'h56e4ab4esa1v2930ced9';
    if (typeof data == 'object') {
        data = sortArrAndReturnStr(data);
        if (partnerKey) data += ('&key=' + partnerKey)
    }
    const hash = crypto.createHash('md5');
    hash.update(data,'utf8');
    return hash.digest('hex');
};
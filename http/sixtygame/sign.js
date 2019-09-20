var _ = require('lodash');
var crypto = require('crypto');

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

/**
 * md5 签名
 * @param data 签名用数据对象
 * @return md5SignStr
 */
exports.md5Sign = function (data, signKey) {
    var partnerKey = signKey || '';
    var signStr = '';
    if (typeof data == 'object') {
        if (!data['orderid'] || !data['money'] || !data['status']) return -1;
        signStr = (data['orderid'] + '' + data['money'] + data['status'] + partnerKey);
    } else {
        signStr = data + partnerKey;
    }
    const hash = crypto.createHash('md5');
    hash.update(signStr, 'utf8');
    return hash.digest('hex');
};

/**
 * sha1 加密
 * @param data 签名用数据对象
 * @param secKey 加密密钥
 * @return sha1加密后字符串
 */
exports.sha1Sign = function (data, secKey) {
    var str = '';
    if (typeof data == 'object') {
        str = sortArrAndReturnStr(data);
    }
    str += secKey;
    const hash = crypto.createHash('sha1');
    hash.update(str, 'utf8');
    return hash.digest('hex');
}
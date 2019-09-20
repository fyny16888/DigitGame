'use strict';


var md5 = require('md5');

const nonce_elem_arr = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

function make_nonceStr() {
  let nonceStr = '';
  for (let i = 0; i < 32; i++)
    nonceStr += nonce_elem_arr[Math.floor(Math.random() * nonce_elem_arr.length) % nonce_elem_arr.length];
  return nonceStr;
}

exports.make_nonceStr = make_nonceStr;

exports.make_sign = function (paramsMap, signKey) {
  if (!paramsMap)
    throw 'paramsMap is err';
  
  // make nonceStr.
  let nonce_str;

  // 参数数组.
  let paramsArr = [];

  if (!paramsMap.nonce_str) {
    nonce_str = make_nonceStr();
    paramsArr.push(['nonce_str', nonce_str]);
  }
  else {
    nonce_str = paramsMap.nonce_str;
  }

  // 遍历参数.
  for (var key in paramsMap) {
    if ('sign' != key)
      paramsArr.push([key, paramsMap[key]]);
  }

  // sort. sort in v8 has bug.
  // paramsArr.sort((a,b)=>{ return a[0] > b[0]; });
  for (let i = 0; i < paramsArr.length; i++) {
    for (let j = i; j < paramsArr.length; j++) {
      if (paramsArr[i][0] > paramsArr[j][0]) {
        let t = paramsArr[i];
        paramsArr[i] = paramsArr[j];
        paramsArr[j] = t;
      }
    }
  }

  // make stringA.
  let stringA = '';
  for (let i = 0; i < paramsArr.length; i++) {
    stringA += paramsArr[i][0] + '=' + paramsArr[i][1] + '&';
  }

  // make stringB.
  stringA += 'key=' + signKey;

  // md5.
  return {
    sign: md5(stringA).toUpperCase(),
    nonce_str: nonce_str
  }
}

exports.validate_sign = function(paramsMap, signKey) {
  if (!paramsMap || !paramsMap.sign)
    throw 'paramsMap is err';
  
  // 参数数组.
  let paramsArr = [];

  // 遍历参数.
  for (var key in paramsMap) {
    if (key == 'sign')
      continue;
    paramsArr.push([key, paramsMap[key]]);
  }

  // sort. sort in v8 has bug.
  // paramsArr.sort((a,b)=>{ return a[0] > b[0]; });
  for (let i = 0; i < paramsArr.length; i++) {
    for (let j = i; j < paramsArr.length; j++) {
      if (paramsArr[i][0] > paramsArr[j][0]) {
        let t = paramsArr[i];
        paramsArr[i] = paramsArr[j];
        paramsArr[j] = t;
      }
    }
  }

  // make stringA.
  let stringA = '';
  for (let i = 0; i < paramsArr.length; i++) {
    stringA += paramsArr[i][0] + '=' + paramsArr[i][1] + '&';
  }

  // make stringB.
  stringA += 'key=' + signKey;
  stringA = md5(stringA).toUpperCase();

  // md5.
  return paramsMap.sign == stringA;
}


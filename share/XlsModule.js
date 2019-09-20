/**
 * xls配置表模块.
 * @author deden-configuration
*/
var xls, isNode;
var isEncrypt = false;
(function (xls) {
    /** 是否已经初始化模块. */
    xls.hasInitialized = initConfig();
    /** 当前加载配置的国家语言. */
    xls.language = 'cn';
    /** 数据文件存储根目录url路径. */
    xls.rootPath = 'resource/excel/';
    /** 配置表ID是否全局唯一. */
    xls.isGlobal = false;
    /** 生成配置的时间戳. */
    xls.createTimestamp = 1469416418374;
    /** 索引表最后修改的时间戳. */
    xls.modificationTimestamp = 1469068861558;
    /** 自定义加载器. */
    xls.customLoader;
    /** 获取配置`模块表`列表. */
    xls.tables;
    /** 获取需要加载的配置项,包含`索引表`和`模块表`列表. */
    xls.requisites;

    /**
     * 初始化配置信息
     * @returns {boolean}
     */
    function initConfig() {
        /** 加载合并的Json大表 */
        xls.load = function (onFinishedCallBack) {
            getResByUrl('items', xls.rootPath + (xls.language ? '/' + xls.language : '') + '/items.json', function (bigJson, url) {
                //获取配置表队列
                var _tables = bigJson['tables'];
                xls.tables = _tables.slice();
                var _len = _tables.length;
                //初始化索引数据，获得合并列表数据表
                var i;
                var mergeList = [];
                xls.requisites = ['items'];
                for (i = 0; i < _len; i++) {
					if (bigJson[_tables[i]].merge){
                        mergeList.push(_tables[i]);
                    }else{
                        xls.requisites.push(_tables[i]);
                    } 
                    flush(bigJson, bigJson[_tables[i]]);
                }
                //获取表类别ID.
                var _getAttribute = function (tableId) {
                    if (!bigJson['table_' + tableId]) {
                        console.warn('ID为' + tableId + '的配置不存在!');
                        return null;
                    }
                    return bigJson['table_' + tableId];
                };
                //通过子健获取独立的数据信息.
                var _getSubkeyItem = function (subfield, subkey, tableId) {
                    if (tableId) {
                        var table = xls[_getAttribute(tableId).name];
                        if (table.hasLoaded) {
                            return table.getSubkeyItem(subfield, subkey);
                        }
                        else {
                            console.warn('配置表' + _getAttribute(tableId).name + '没有加载.');
                            return null;
                        }
                    }
                    else {
                        console.warn('必须指定tableId值.');
                        return null;
                    }
                };
                //通过ID获取独立的数据信息.
                var _getItem = function (id, tableId) {
                    if (tableId) {
                        var table = xls[_getAttribute(tableId).name];
                        if (table.hasLoaded) {
                            return table.getItem(id);
                        }
                        else {
                            console.warn('配置表' + _getAttribute(tableId).name + '没有加载.');
                            return null;
                        }
                    }
                    else {
                        if (xls.isGlobal) {
                            return bigJson[id];
                        }
                        else {
                            console.warn('非全局ID打表模式必须指定tableId值.');
                            return null;
                        }
                    }
                };
                //通过ID获取独立的数据信息.
                var _getItems = function (tableId) {
                    var table = xls[_getAttribute(tableId).name];
                    if (table.hasLoaded) {
                        return table.getItems();
                    }
                    else {
                        console.warn('配置表' + _getAttribute(tableId).name + '没有加载.');
                        return null;
                    }
                };
                xls.getSubkeyItem = _getSubkeyItem;
                xls.getItem = _getItem;
                xls.getItems = _getItems;
                xls.getAttribute = _getAttribute;
                //合并表初始化
                var _count = _len = mergeList.length;
				for (i = 0; i < _len; i++) {
					xls[mergeList[i]].load(function () {
                        _count--;
                        if (_count <= 0) {
                            xls.hasInitialized = true;
                            onFinishedCallBack(bigJson, url);
                        }
                    });
                }
            }, xls.modificationTimestamp);
        };
        /** 加载所有配置 */
        xls.loadAll = function (onFinishedCallBack) {          
            xls.load(function (bigJson, url) {
                //获取配置表队列
                var _tables = bigJson['tables'];
                var list = _tables.slice();
                var loadSingleTable = function () {
                    if (list.length) {
                        xls[list.shift()].load(loadSingleTable);
                    }
                    else {
                        if (onFinishedCallBack)
                            onFinishedCallBack(bigJson, url);
                    }
                };
                loadSingleTable();
            });
        };
        return false;
    }
    /**
     * 植入JSON数据
     * @param bigJson
     * @param obj
     */
    function flush(bigJson, obj, onFinishedCallBack, associateMultidimensional) {
        var url = xls.rootPath + '/' + (xls.language ? '/' + xls.language : '') + '/' + obj.name + '.json';
        url = url.replace(/\/\/+/g, '/');
        //给模块接口赋值
        var _attributes = xls[obj.name] || (xls[obj.name] = {});
        //关联多为表数据.
        var _flushMultidimensionalData = function (values, multidimensional, multidimensionalValues, onSubFinishedCallBack) {
            //映射表信息
            var tableInfo = multidimensional.table;
            //是否加载过
			if (_attributes.hasLoaded) {
				onSubFinishedCallBack(obj.values, url);
				return;
			}
            //创建子健对象
            var subkey = bigJson[tableInfo[0]].subkey || (bigJson[tableInfo[0]].subkey = {});
            var j, k, len, len2, subObj, key, defValues, value;
            switch (multidimensional.type) {
                case 'info':
                    key = tableInfo[1];
                    if (subkey[key]) {
                        xls[tableInfo[0]].load(function () {
							if (multidimensional.split) {
								for (j = 0, len = values.length; j < len; j++) {
									subObj = values[j];
									defValues = subObj[multidimensional.field].split(multidimensional.split[0]); //分解数组
									var infoList = [];
									for (k = 0, len2 = defValues.length; k < len2; k++) {
										infoList.push(subkey[key][defValues[k]]);
									}
									subObj['$' + multidimensional.field] = infoList;
								}
							} else {
								for (j = 0, len = values.length; j < len; j++) {
									subObj = values[j];
									subObj['$' + multidimensional.field] = subkey[key][subObj[multidimensional.field]];
								}
							}
                            onSubFinishedCallBack(obj.values, url);
                        });
                    }
                    else {
                        onSubFinishedCallBack(obj.values, url);
                    }
                    break;
                case 'definition':
                    var l, len3;
                    var definitionVlues = [];
                    if (multidimensional.split) {
	                    for (j = 0, len = values.length; j < len; j++) {
	                        var definitionList = [];
	                        if (values[j][multidimensional.field]) {
	                            defValues = values[j][multidimensional.field].split(multidimensional.split[0]); //定义原始数据
	                            for (k = 0, len2 = defValues.length; k < len2; k++) {
	                                subObj = {};
	                                definitionList.push(subObj);
	                                var subValues = defValues[k].split(multidimensional.split[1]);
	                                var fields = multidimensionalValues.fields;
	                                var types = multidimensionalValues.types;
	                                for (l = 0, len3 = fields.length; l < len3; l++) {
	                                    if (types[l] == 'string') {
	                                        subObj[fields[l]] = subValues[l] || null;
	                                    }
	                                    else {
	                                        subObj[fields[l]] = +subValues[l] || null;
	                                    }
	                                }
	                            }
	                        }
	                        definitionVlues = definitionVlues.concat(definitionList);
	                        values[j][multidimensional.field] = definitionList;
	                    }
                    }else{
                    	for (j = 0, len = values.length; j < len; j++) {	                        
	                        if (values[j][multidimensional.field]) {
                                subObj = {};
                                var subValues = values[j][multidimensional.field].split(multidimensional.split[0]); 
                                var fields = multidimensionalValues.fields;
                                var types = multidimensionalValues.types;
                                for (l = 0, len3 = fields.length; l < len3; l++) {
                                    if (types[l] == 'string') {
                                        subObj[fields[l]] = subValues[l] || "";
                                    }
                                    else if (types[l].search(/^\s*(?:number|int|uint)\s*$/) != -1) {
                                        subObj[fields[l]] = subValues[l] || 0;
                                    }
                                    else {
                                        subObj[fields[l]] = +subValues[l] || null;
                                    }
                                }
                                definitionVlues.push(subObj);
	                        }
	                        values[j][multidimensional.field] = subObj;
	                    }
                    }
                    bigJson[tableInfo[0]].values = definitionVlues;
					flush(bigJson, bigJson[tableInfo[0]], function () {
                        bigJson[tableInfo[0]].values.length = 0;
						onSubFinishedCallBack(obj.values, url);
                    }, true);
                    break;
                case 'link':
                    key = tableInfo[1];
                    if (subkey[key]) {
                        xls[tableInfo[0]].load(function () {
                            for (j = 0, len = values.length; j < len; j++) {
                                subObj = values[j];
                                if ((value = subkey[key][subObj[multidimensional.field]]) != null) {
                                    subObj[multidimensional.field] = value[tableInfo[2]] || null;
                                }
                                else {
                                    console.warn('配置表' + obj.name + ',' + multidimensional.field + '字段，值为(' + subObj[multidimensional.field] + ')的映射数据不存在.');
                                    subObj[multidimensional.field] = null;
                                }
                            }
                            onSubFinishedCallBack(obj.values, url);
                        });
                    }
                    else {
                        onSubFinishedCallBack(obj.values, url);
                    }
                    break;
            }
        };
        //将数据信息个根据ID作为key索引到独立实例.
        var _flushData = function (callback, associate) {
            var values = obj.values;
            if (values) {
                var len2 = values.length;
                var j, k, key, htmlValue, len3, len4, element;
                var htmlList = obj.htmlField;
                var multidimensional = obj.multidimensional;
                var multidimensionalValues = obj.multidimensionalValues;
                var subObj = obj.subkey || (obj.subkey = {});
                if (htmlList) {
                    len3 = htmlList.length;
                    if (xls.isGlobal) {
                        for (j = 0; j < len2; j++) {
                            values[j].getTableId = _getTableId;
                            bigJson[values[j].id] = values[j];
                            for (key in subObj) {
                                subObj[key][values[j][key]] = values[j];
                            }
                            for (k = 0; k < len3; k++) {
                                htmlValue = values[j][htmlList[k]];
                                if (htmlValue)
                                    values[j][htmlList[k]] = decodeHtml(htmlValue);
                            }
                        }
                    }
                    else {
                        var data = obj['data'] = {};
                        for (j = 0; j < len2; j++) {
                            values[j].getTableId = _getTableId;
                            data[values[j].id] = values[j];
                            for (key in subObj) {
                                subObj[key][values[j][key]] = values[j];
                            }
                            for (k = 0; k < len3; k++) {
                                htmlValue = values[j][htmlList[k]];
                                if (htmlValue)
                                    values[j][htmlList[k]] = decodeHtml(htmlValue);
                            }
                        }
                    }
                }
                else {
                    if (xls.isGlobal) {
                        for (j = 0; j < len2; j++) {
                            values[j].getTableId = _getTableId;
                            bigJson[values[j].id] = values[j];
                            for (key in subObj) {
                                subObj[key][values[j][key]] = values[j];
                            }
                        }
                    }
                    else {
                        var data = obj['data'] = {};
                        for (j = 0; j < len2; j++) {
                            values[j].getTableId = _getTableId;
                            data[values[j].id] = values[j];
                            for (key in subObj) {
                                subObj[key][values[j][key]] = values[j];
                            }
                        }
                    }
                }
                if (multidimensional && associate) {                   
                        len4 = multidimensional.length;
                        var _count = len4;
                        for (j = 0; j < len4; j++) {
                            {
                                _flushMultidimensionalData(values, multidimensional[j], multidimensionalValues?multidimensionalValues[j]:"", function () {
                                    _count--;
                                    if (_count <= 0) {
                                        callback();
                                    }
                                });
                            }
                        }
                }
                else {
                    callback();
                }
            }
        };
        //获取表属性
        var _getAttribute = function () {
            return obj;
        };
        //通过子健获取实例项.
        var _getSubkeyItem = function (subfield, subkey) {
            var result = obj.subkey[subfield];
            if (!result) {
                console.warn('配置表' + obj.name + '中不存在子健为' + subfield + '的字段.');
                return null;
            }
            result = result[subkey];
            if (!result)
                console.warn('配置表' + obj.name + ',' + subfield + '列中不存在子健为' + subkey + '的数据项.');
            return result;
        };
        //通过ID获取实例项.
        var _getItem = function (id) {
            var result = xls.isGlobal ? bigJson[id] : obj.data && obj.data[id];
            if (!result)
                console.warn('配置表' + obj.name + '中不存在ID为' + id + '的数据项.');
            return result;
        };
        //获取实例队列.
        var _getItems = function () {
            return obj.values;
        };
        //获取表ID.
        var _getTableId = function () {
            return obj.id;
        };
        //加载子表
        var _load = function (onSubFinishedCallBack) {
            var _flushDataOnTableLoaded = function (data, url) {
            	if(_attributes.hasLoaded){
            		onSubFinishedCallBack(obj.values, url);
            		return;
            	}
                obj.values = data;
                _flushData(function () {
                    _attributes.hasLoaded = true;
                    onSubFinishedCallBack(data, url);
                }, true);
            }
            //外部子表加载完成，合并到大表中
            if (_attributes.hasLoaded) {
                if (isNode) {
					onSubFinishedCallBack(obj.values, url);
				} else {
					egret.callLater(onSubFinishedCallBack, this, obj.values, url);
				}
            }
            else if (obj.merge) {
                if (isNode) {
					_flushDataOnTableLoaded(obj.values, url);
				} else {
					egret.callLater(_flushDataOnTableLoaded, this, obj.values, url);
				}
            }
            else {
                getResByUrl(_attributes.getAttribute().name, url, _flushDataOnTableLoaded, obj.modification);
            }
        };
        //给模块接口赋值
        _attributes.hasLoaded = false;
        _attributes.load = _load;
        _attributes.getAttribute = _getAttribute;
        _attributes.getItem = _getItem;
        _attributes.getSubkeyItem = _getSubkeyItem;
        _attributes.getItems = _getItems;
        bigJson['table_' + obj.id] = obj;
        if (associateMultidimensional) {
			_flushData(function () {
				onFinishedCallBack(obj.values, url);
			}, true);
		}
    }


    //加载顺序列表
	var sortLoadList = [];
	//是否在加载中
	var isLoading = false;

	/**
	 * 载入配置文件的加载器，可设置自定义加载器.
	 */
	function getResByUrl(table, url, compFunc, modification) {
        if (isLoading) {
			sortLoadList.push([table, url, compFunc, modification]);
			return;
		}
		isLoading = true;
		var cb = function (data) {
			isLoading = false;
			compFunc(data, url);
			if (sortLoadList.length) getResByUrl.apply(this, sortLoadList.shift());
		}
		if (table != 'items' && xls[table].hasLoaded){
            cb(xls[table].getItems(), url);
            return;
        } 

		if (xls.customLoader) {
			xls.customLoader(isNode, isEncrypt, modification, table, url, cb);
		} else {
			if (isNode) {
				cb(require(url), url);
			} else {
				RES.getResByUrl(url + "?v=" + modification, cb, this, RES.ResourceItem.TYPE_JSON);
			}
		}
	}

    /** 解码带html支持的配置表 */
    function decodeHtml(str) {
        var reg = /&lt;|&gt;|&amp;|&apos;|&quot;/g;
        return str.replace(reg, function (marchStr, replaceStr) {
            switch (marchStr) {
                case "&lt;":
                    return "<";
                case "&gt;":
                    return ">";
                case "&amp;":
                    return "&";
                case "&apos;":
                    return "’";
                case "&quot;":
                    return "\"";
            }
            return marchStr;
        });
    }
})(xls || (xls = {}));
/** 兼容nodejs的判断语句. */
try{
    if (require && module && require("child_process")) {
        isNode = true;
        if (xls.rootPath.indexOf(":") == -1 && xls.rootPath.indexOf("./") != 0) {
            xls.rootPath = "./" + xls.rootPath;
            xls.rootPath = xls.rootPath.replace(/\/\/+/g, '/');
        }
        module.exports = global.xls = xls;
    }
}catch(e){};

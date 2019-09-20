/**
 * xls配置表模块.
 * @author deden-configuration
*/
declare module xls {
    /** 是否已经初始化模块,并加载完成索引表数据. */
    var hasInitialized: boolean;
    /** 当前加载配置的国家语言. */
    var language: string;
    /** 数据文件存储根目录url路径. */
    var rootPath: string;
    /** 配置表ID是否全局唯一. */
    var isGlobal: boolean;
    /** 生成配置的时间戳. */
    var createTimestamp: number;
    /** 索引表最后修改的时间戳. */
    var modificationTimestamp: number;
    /** 自定义加载器. */
    var customLoader:(isNode: boolean, isEncrypt: boolean,  modification: number, table:string, url: string, compFunc: (data: any, url: string)=>void)=>void;
    /** 获取配置`模块表`列表. */
    var tables: string[];
    /** 获取需要加载的配置项,包含`索引表`和`模块表`列表. */
    var requisites: string[];
    /**
     * 通过全局唯一ID获取独立的数据项信息.
     *```
     * getItem: (globalId: number);
     * ```
     * 通过指定的表索引ID和表的本地ID获取独立数据项信息.
     *```
     * getItem: (localId: number, tableId: number);
     * ```
     */
    var getItem: (id: number, tableId?: number) => IItemBaseInfo;
    /**    
     * 通过指定的表索引ID和表的key获取独立数据项信息.
     *```
     * getSubkeyItem: (localId: number|string, tableId: number);
     * ```
     */
    var getSubkeyItem: (subfield: number | string, subkey: number | string, tableId: number) => IItemBaseInfo;
    /**
     * 通过索引表的索引ID获取整个表的所有数据项信息.
     */
    var getItems: (tableId: number) => IItemBaseInfo[];
    /**
     * 通过表索引表的索引ID获取表属性信息.
     */
    var getAttribute: (tableId: number) => ITableAttributeInfo;
    /**
     * 加载合并的Json大表.
     * @param onFinishedCallBack 加载完成回调.
     */
    var load: (onFinishedCallBack: (data?: any, url?: string) => void) => void;
    /**
    * 加载所有配置.
    * @param onFinishedCallBack 加载完成回调.
    */
    var loadAll: (onFinishedCallBack: (data?: any, url?: string) => void) => void;
}
declare module xls
{
	/**
	 * ###配置表（props.xls）的数据.
	 */
	var props:IProps;
	/**
	 * ###配置表（tips.xls）的数据.
	 */
	var tips:ITips;

}

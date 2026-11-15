// Each device is [type, gate, terminal 1, terminal 2]. Equal net names connect.
const Library=(()=>{
  const cells=[], groups=['基础逻辑','复合逻辑','数据选择','时序存储','时钟','常量','物理与供电'];
  function cell(id,name,group,pins,expr,principle,use,layout,build,fn,out='Y'){
    const blocks=[];
    const add=(name,devices,tree)=>blocks.push({name,devices,tree});
    const series=(...nodes)=>({series:true,nodes}), parallel=(...nodes)=>({series:false,nodes});
    function gate(name,net,down){
      let count=0;const devices=[];
      function walk(node,type,start,end){
        if(typeof node==='string'){devices.push([type,node,start,end]);return;}
        const serial=type==='n'?node.series:!node.series;
        let prev=start;
        node.nodes.forEach((part,i)=>{
          const next=serial&&i<node.nodes.length-1?net+'·'+(++count):end;
          walk(part,type,serial?prev:start,next);prev=next;
        });
      }
      walk(down,'p','VDD',net);walk(down,'n',net,'VSS');add(name,devices,{down,net});
    }
    const inv=(a,y)=>gate('反相 · '+y,y,a);
    function tg(a,y,on,off){add('传输门 · '+a+' → '+y,[['n',on,a,y],['p',off,a,y]]);}
    function mux(d0,d1,s,sb,y){tg(d0,y,sb,s);tg(d1,y,s,sb);}
    function latch(d,q,en,eb,prefix,reset){
      const x=prefix+'X',xb=prefix+'B';
      tg(d,x,en,eb);inv(x,xb);
      if(reset)gate('复位输出 · '+q,q,parallel(xb,reset));else inv(xb,q);
      tg(q,x,eb,en);
    }
    function ff(input,reset){inv('CLK','CKB');latch(input,'M','CKB','CLK','M',reset);latch('M','Q','CLK','CKB','S',reset);}
    if(build)build({gate,inv,tg,mux,latch,ff,add,series,parallel});
    cells.push({id,name,group:groups[group],pins:pins?pins.split(' '):[],expr,principle,use,layout,blocks,fn,out});
  }
  cell('INV','反相器',0,'A','Y = ¬A','A 为低时 PMOS 上拉 Y，A 为高时 NMOS 下拉 Y。两管共栅、共漏。','产生互补控制信号，或修正负逻辑端口的极性。','上下两个器件的栅同接 A，输出侧的两个漏端同接 Y。',b=>b.inv('A','Y'),v=>1-v.A);
  cell('BUF','同相缓冲器',0,'A','Y = A','两级反相器串接，内部节点 X 与 A 反相，输出恢复原极性。','在长线中插入缓冲或驱动较大的扇出，选型时结合负载与时序表。','第一列产生 X，第二列由 X 驱动；实际驱动档位可改变鳍数。',b=>{b.inv('A','X');b.inv('X','Y');},v=>v.A);
  const binary=[
    ['NAND2','二输入与非门','¬(A ∧ B)','两个 NMOS 串联，仅当 A、B 都为 1 时放电；任一输入为 0 均有 PMOS 上拉。','把两个同时成立的条件转换为低有效请求。'],
    ['NOR2','二输入或非门','¬(A ∨ B)','两个 NMOS 并联，任一输入为 1 都能放电；上拉要求两个 PMOS 同时导通。','检测多个请求均未置位的空闲状态。'],
    ['AND2','二输入与门','A ∧ B','与非级先计算 X = ¬(A ∧ B)，末级反相后只有两个输入均为 1 才输出 1。','将数据有效与接收就绪组合成传输握手。'],
    ['OR2','二输入或门','A ∨ B','或非级先检测两个输入是否均为 0，随后反相，任一输入为 1 时输出 1。','汇总多个独立的告警或请求。']
  ];
  for(const [id,name,expr,principle,use] of binary){
    const and=id.includes('AND'),neg=id.startsWith('N');
    cell(id,name,0,'A B','Y = '+expr,principle,use,(and?'下拉串联支路有内部连接，上拉两管共用两端网络。':'上拉串联支路有内部连接，下拉两管均跨接输出与 VSS。')+(neg?'':' 末端另设反相级。'),b=>{b.gate('互补逻辑',neg?'Y':'X',(and?b.series:b.parallel)('A','B'));if(!neg)b.inv('X','Y');},v=>Number(Boolean(and?v.A&&v.B:v.A||v.B)!==neg));
  }
  for(const size of [21,22])for(const and of [true,false]){
    const id=(and?'AOI':'OAI')+size, four=size===22;
    const expr=and?(four?'¬((A ∧ B) ∨ (C ∧ D))':'¬((A ∧ B) ∨ C)'):(four?'¬((A ∨ B) ∧ (C ∨ D))':'¬((A ∨ B) ∧ C)');
    cell(id,(and?'与或非':'或与非')+'复合门',1,four?'A B C D':'A B C','Y = '+expr,
      (and?'下拉网络中 A、B 串联，和':'下拉网络中 A、B 并联，再和')+(four?(and?' C、D 的串联支路并联。':' C、D 的并联支路串联。'):(and?' C 支路并联。':' C 管串联。'))+'上拉网络交换串、并联关系，得到互补输出。',
      and?(four?'将两组条件匹配合并为一个低有效输出。':'在译码路径中合并双条件匹配与独立请求。'):(four?'合并两组“至少一个有效”条件，用于组合判决。':'把一组请求与公共使能组合为低有效控制。'),
      '按 '+(four?'A、B、C、D':'A、B、C')+' 的栅网展开上下管；中间节点表示串联连接，重复的 Y 表示并联支路汇合。',
      b=>{const inner=and?b.series:b.parallel,outer=and?b.parallel:b.series;b.gate('复合 CMOS 网络','Y',outer(inner('A','B'),four?inner('C','D'):'C'));},
      v=>Number(!(and?((v.A&&v.B)||(four?v.C&&v.D:v.C)):((v.A||v.B)&&(four?v.C||v.D:v.C)))));
  }
  for(const eq of [false,true]){
    cell(eq?'XNOR2':'XOR2',eq?'二输入同或门':'二输入异或门',1,'A B',eq?'Y = ¬(A ⊕ B)':'Y = A ⊕ B',
      '先生成 A、B 的反相信号，再用互补传输门选择数据。A=0 时选择 '+(eq?'¬B，A=1 时选择 B。':'B，A=1 时选择 ¬B。'),
      eq?'构造按位相等比较，多位结果可再经与门汇总。':'用作半加器的和位，或计算多位数据的奇偶校验。',
      '两列反相器产生 AB、BB 两个反相信号；两个传输支路的输出端共接 Y。',b=>{b.inv('A','AB');b.inv('B','BB');b.mux(eq?'BB':'B',eq?'B':'BB','A','AB','Y');},v=>(v.A^v.B)^Number(eq));
  }
  cell('MUX2','二选一多路器',2,'D0 D1 S','Y = S ? D1 : D0','S 与其反相 SB 控制互斥的两组传输门。被选支路的 NMOS 与 PMOS 同时导通，传递高、低两种电平。','选择旁路数据、运算数或两个功能模式的数据通路。','两条数据通道分别接 D0、D1，并在 Y 汇合。',b=>{b.inv('S','SB');b.mux('D0','D1','S','SB','Y');},v=>v.S?v.D1:v.D0);
  cell('LATCH','高电平透明锁存器',3,'D EN','EN = 1 ⇒ Q 跟随 D','EN 高时输入传输门导通，反馈断开；EN 低时输入隔离，反馈传输门闭合，由两级反相器保持 Q。','用于电平敏感流水或允许时间借用的路径。','观察输入通道 D→LX 和反馈通道 Q→LX 的互补控制。',b=>{b.inv('EN','EB');b.latch('D','Q','EN','EB','L');},null,'Q');
  for(const id of ['DFF','DFFR','SDFF']){
    const reset=id==='DFFR',scan=id==='SDFF';
    cell(id,reset?'异步复位 D 触发器':scan?'扫描 D 触发器':'上升沿 D 触发器',3,scan?'D SI SE CLK':reset?'D CLK RST':'D CLK',reset?'RST = 1 ⇒ Q = 0；↑CLK ⇒ Q ← D':scan?'↑CLK ⇒ Q ← (SE ? SI : D)':'↑CLK ⇒ Q ← D',
      (scan?'SE 先在 SI 与 D 之间选择。':'')+'主锁存器在低电平采样，从锁存器在高电平打开；主从交接使 Q 在上升沿更新。'+(reset?'高有效 RST 异步清零两级存储节点，释放后等待有效边沿。':''),
      reset?'用于需要确定复位状态的状态机和控制寄存器。':scan?'将前级扫描输出接到 SI，SE=1 时逐拍移入测试向量。':'用于流水线边界和同步寄存器，按时钟周期保存状态。',
      (scan?'输入端增加扫描选择传输门。':reset?'主、从输出级均含受 RST 控制的或非网络。':'主、从各含一组输入门和保持环。')+'时钟互补线分别送往两级。',
      b=>{if(scan){b.inv('SE','SEB');b.mux('D','SI','SE','SEB','DX');}b.ff(scan?'DX':'D',reset?'RST':null);},null,'Q');
  }
  for(const buf of [true,false])cell(buf?'CLKBUF':'CLKINV',buf?'时钟缓冲器':'时钟反相器',4,'CLK',buf?'Y = CLK':'Y = ¬CLK',
    (buf?'两级反相恢复时钟极性。':'单级反相产生互补时钟。')+'时钟库会针对负载下的上升、下降转换和延迟进行表征。',
    buf?'在时钟树分支驱动多个寄存器，配合时钟树综合控制插入延迟与偏斜。':'在需要相反时钟极性的分支中翻转边沿，同时计入时钟树时序。',
    '图示采用示例性并联鳍数；实际时钟单元的尺寸由驱动和边沿对称性目标决定。',b=>{b.inv('CLK',buf?'X':'Y');if(buf)b.inv('X','Y');},v=>buf?v.CLK:1-v.CLK);
  cell('ICG','集成时钟门控',4,'CLK EN','GCLK = CLK ∧ Eₗ','低电平锁存器在 CLK=0 时捕获 EN，在 CLK=1 时保持 Eₗ。与门只在已锁存的使能有效时放行完整高脉冲。','门控空闲模块时钟以降低切换功耗。实际设计需检查门控建立与保持时间。','低相透明锁存部分和输出与门沿同一行排列，共用 CLK 网络。',b=>{b.inv('CLK','CKB');b.latch('EN','EL','CKB','CLK','L');b.gate('门控与非','GB',b.series('CLK','EL'));b.inv('GB','GCLK');},null,'GCLK');
  for(const hi of [true,false])cell(hi?'TIEHI':'TIELO',hi?'常高单元':'常低单元',5,'',hi?'Y = 1':'Y = 0',
    (hi?'二极管连接的 NMOS 将偏置 X 拉低，使 PMOS 导通并向 Y 提供高电平。':'二极管连接的 PMOS 将偏置 X 拉高，使 NMOS 导通并向 Y 提供低电平。')+'此处展示一种静态偏置实现。',
    '为未使用的控制输入或固定模式引脚提供常量；按库规范限制扇出和距离。','偏置管的栅、漏同网 X，另一管将输出拉到指定电源轨。',b=>b.add('常量偏置',hi?[['n','X','X','VSS'],['p','X','VDD','Y']]:[['p','X','VDD','X'],['n','X','Y','VSS']]),()=>Number(hi));
  const physical=[
    ['FILL','填充单元','填补放置空隙','延续相邻单元的电源轨和所需阱层，填满行内未占用的站点。','完成布局后填补剩余空位，维持行内层图形连续。','电源轨跨越空白站点；此例没有逻辑器件。'],
    ['TAP','阱接触单元','阱 / 衬底接电源','在体硅双阱示例中，N 阱通过 N+ 接触接 VDD，P 阱通过 P+ 接触接 VSS，固定体电位。','按工艺规定的最大间距插入阱接触，控制体电阻并降低闩锁风险。','上下两组接触阵列分别连到对应阱和电源轨。'],
    ['ENDCAP','行端边界单元','终止标准单元行','在行端形成合规的阱、鳍或虚设栅终止环境，保护相邻功能单元的边界。','放在行首、行尾及部分宏单元周边，处理边界设计规则。','示例标出行端界线、虚设栅和鳍终止区。'],
    ['DECAP','去耦电容单元','VDD 与 VSS 间储能','本例使用 MOS 电容：NMOS 栅极接 VDD，源漏与体接 VSS。电源瞬态变化时释放或吸收电荷，Q = C·V。','靠近瞬态电流较大的区域布置，缓解局部供电压降。','栅条并接 VDD，鳍两端接 VSS；实际电容量随偏置、尺寸和工艺变化。']
  ];
  for(const [id,name,expr,why,use,layout] of physical)cell(id,name,6,'',expr,why,use,layout,null,null,null);
  return {cells,groups};
})();

// Page text and initial conditions for the nine experiments.
// Equations use native MathML so they remain selectable and scale with zoom.
window.diodeLessons = [
  {
    name:'形成 PN 结', group:'入门', view:'space', title:'从两块硅，到一个 PN 结',
    question:'把 P 型硅与 N 型硅接触后，最先扩散的是哪些载流子？留下的空间电荷带什么电？',
    controls:['na','nd'], heading:'扩散留下固定的离化杂质',
    formula:'<msub><mi>N</mi><mi>A</mi></msub><msub><mi>x</mi><mi>p</mi></msub><mo>=</mo><msub><mi>N</mi><mi>D</mi></msub><msub><mi>x</mi><mi>n</mi></msub>',
    text:'接触后，电子从 N 区向 P 区扩散，空穴从 P 区向 N 区扩散。在结附近，P 侧留下带负电的受主，N 侧留下带正电的施主。两侧固定电荷总量相等，内建电场由 N 侧指向 P 侧。',
    note:'“形成 PN 结”切换接触前与热平衡两个状态。截面中的粒子用于区分载流子和杂质种类；数量及距离请读取数值和空间剖面。'
  },{
    name:'热平衡', group:'入门', view:'space', title:'零偏时，电流去了哪里？',
    question:'分别显示漂移和扩散，再切换到粒子运动方向。哪两种电流在同一种载流子内部抵消？',
    controls:['na','nd','temp'],heading:'热平衡时每种载流子的净电流均为零',
    formula:'<msub><mi>J</mi><mtext>漂移</mtext></msub><mo>+</mo><msub><mi>J</mi><mtext>扩散</mtext></msub><mo>=</mo><mn>0</mn>',
    text:'电子扩散方向由 N 到 P，其常规电流方向由 P 到 N。内建电场引起的电子漂移与扩散方向相反。空穴也各自达到平衡，所以外部电流表读零。',
    note:'一维突变同质结、完全电离、热平衡。内建电势是器件内部的静电势差；平衡时同温欧姆接触之间测得的端电压为零。'
  },{
    name:'正偏与反偏', group:'入门', view:'dc', title:'连续扫过反偏、零偏与正偏',
    question:'从零开始升高正向电压，观察势垒和端口电流。换到半对数坐标，能找到唯一的“开启电压”吗？',
    controls:['bias','temp','rs'], heading:'端电压分配在结与串联电阻上',
    formula:'<mi>V</mi><mo>=</mo><msub><mi>V</mi><mi>j</mi></msub><mo>+</mo><mi>I</mi><msub><mi>R</mi><mi>s</mi></msub>',
    text:'这里定义正向电压为 P 端电位高于 N 端。正偏降低能垒并增强注入，反偏提高能垒并加宽耗尽区。读出端口电压与结电压，比较串联电阻增加后的差异。',
    preset:{bias:0.52},note:'用结电流与串联电阻联立求工作点。理想扩散电流适用于低注入；接近平带时，耗尽近似失去定量精度。'
  },{
    name:'掺杂与空间电荷',group:'进阶',view:'space',title:'耗尽层向哪一侧延伸？',
    question:'从对称结出发，只把 N 侧掺杂提高 100 倍。用位置游标比较两侧耗尽宽度和结处的电场。',
    controls:['na','nd','bias'],heading:'电场由空间电荷决定',
    formula:'<mfrac><mrow><mi>d</mi><mi>E</mi></mrow><mrow><mi>d</mi><mi>x</mi></mrow></mfrac><mo>=</mo><mfrac><mi>ρ</mi><msub><mi>ε</mi><mtext>Si</mtext></msub></mfrac>',
    text:'耗尽区主要伸入轻掺杂侧。电荷密度在突变结两侧近似分段常数，电场因此呈分段直线，绝对值在冶金结处达到最大。沿位置轴比较这三者和能带弯曲。',
    preset:{na:1e16,nd:1e16},note:'假设掺杂均匀、结面积恒定且耗尽区远小于器件尺寸。高掺杂时简并与带隙变窄会影响定量结果。'
  },{
    name:'少子输运',group:'进阶',view:'space',title:'正向电流从哪里来？',
    question:'提高少子寿命，再看注入的少数载流子能扩散多远。电子电流与空穴电流之和随位置变化吗？',
    controls:['bias','tau','na','nd'],heading:'扩散长度由寿命和扩散系数决定',
    formula:'<msub><mi>L</mi><mi>n</mi></msub><mo>=</mo><msqrt><mrow><msub><mi>D</mi><mi>n</mi></msub><msub><mi>τ</mi><mi>n</mi></msub></mrow></msqrt>',
    text:'正偏时电子被注入 P 区、空穴被注入 N 区。进入准中性区后，过剩少子浓度随远离结边界而衰减。复合改变两种载流子承担电流的比例，稳态总电流保持连续。',
    preset:{bias:.48},note:'一维长基区、低注入、均匀少子寿命；两侧采用同一可调寿命。耗尽区内部的精细输运需联立求解漂移扩散方程。'
  },{
    name:'直流特性',group:'进阶',view:'dc',title:'读一条 I–V 曲线',
    question:'冻结一条曲线，再提高温度。比较相同电压下的电流，以及相同电流下的压降。',
    controls:['bias','temp','area','rs','tau'],heading:'用局部斜率提取微分电阻',
    formula:'<msub><mi>r</mi><mi>d</mi></msub><mo>=</mo><mfrac><mrow><mi>d</mi><mi>V</mi></mrow><mrow><mi>d</mi><mi>I</mi></mrow></mfrac>',
    text:'在正向半对数曲线上，两点间的电压差与电流对数差给出表观理想因子。结区复合、扩散和串联电阻会改变斜率。选点跨越不同主导区时，得到的是区间平均值。',
    preset:{bias:.60},note:'面积按有效结面积处理，忽略侧壁漏电与自热。串联电阻是独立可调的集总参数。'
  },{
    name:'结电容与扩散电容',group:'高级',view:'dc',title:'两种电容，各储存什么电荷？',
    question:'先在反偏段看结电容，再移到正偏段改变寿命。哪一项电容最敏感？',
    controls:['bias','na','nd','area','tau'],heading:'耗尽区宽度决定结电容',
    formula:'<msub><mi>C</mi><mi>j</mi></msub><mo>=</mo><mfrac><mrow><msub><mi>ε</mi><mtext>Si</mtext></msub><mi>A</mi></mrow><mi>W</mi></mfrac>',
    text:'反偏越深，耗尽区越宽，结电容越小。对均匀突变结，反偏区的结电容平方倒数与结电压呈线性关系。正向注入存储过剩少子，电荷对结电压的导数给出准静态扩散电容。',
    preset:{bias:-1},note:'曲线给出本征结的小信号准静态电容。外部电阻压降、测量频率和器件寄生会改变仪器读数。'
  },{
    name:'反向恢复',group:'高级',view:'time',title:'关断时，反向电流持续多久？',
    question:'增加正向脉冲宽度，再拖动双游标。比较反向电流峰值、恢复时间与积分电荷。',
    controls:['forward','reverse','pulse','load','tau','rs'],heading:'恢复电荷取自反向电流的面积',
    formula:'<msub><mi>Q</mi><mtext>rr</mtext></msub><mo>=</mo><mo>−</mo><msubsup><mo>∫</mo><msub><mi>t</mi><mn>0</mn></msub><msub><mi>t</mi><mtext>end</mtext></msub></msubsup><mi>i</mi><mo>(</mo><mi>t</mi><mo>)</mo><mi>d</mi><mi>t</mi>',
    text:'电压反转后，先前注入的少子仍存储在器件内。反向电流抽走电荷，同时载流子也在复合。改变驱动电压和限流电阻，即使对同一只二极管也会得到不同的恢复时间。',
    note:'时域采用集总电荷控制近似。恢复时间从电流过零计至峰值后反向电流幅值降至峰值的 25%，恢复电荷在同一区间积分。器件截面展示指定的直流状态，瞬态读数见脉冲响应。'
  },{
    name:'反向击穿',group:'高级',view:'dc',title:'反向击穿时，谁限制了电流？',
    question:'切换轻掺杂与重掺杂预设，扫过击穿膝点。继续提高电源幅值时，增加的电压主要落在哪里？',
    controls:['bias','na','nd','load','rs'],heading:'用负载线寻找击穿工作点',
    formula:'<msub><mi>V</mi><mtext>源</mtext></msub><mo>=</mo><msub><mi>V</mi><mtext>端</mtext></msub><mo>+</mo><mi>I</mi><msub><mi>R</mi><mi>L</mi></msub>',
    text:'窄而强场的耗尽区有利于带间隧穿；碰撞电离可使载流子倍增，形成雪崩。两种机制可能共存。扫过膝点后，对照电源、二极管端口与结上的电压。',
    preset:{na:3e17,nd:3e17,bias:-8,load:1000},note:'击穿膝点与机制权重采用教学用参数模型，适合比较趋势。精确击穿电压、热失控与最大安全功耗需要具体器件的标定数据。'
  }
];

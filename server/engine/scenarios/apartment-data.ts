import { ScenarioDataLayerSchema } from "@/domain/scenes/scenario-data";
import { apartmentScenarioProbes } from "@/server/engine/scenarios/apartment-probes";

export const apartmentScenarioData = ScenarioDataLayerSchema.parse({
  sceneId: "apartment-tradeoff",
  publicInfo: {
    constraints: {
      budgetMaxYuan: 6200,
      moveInDeadline: "6/1 前",
      petPolicy: "宠物条款须写入书面合同/补充协议，口头承诺不算",
    },
    apartments: {
      A: {
        name: "城郊次新·两居整租",
        rent: "5980/月（含物业，不含网费）",
        commute: "地铁+步行约 50 分钟（中介口径；早高峰待核验）",
        light: "客厅南向尚可；次卧朝北，白天偏暗（待核验可接受度）",
        noise: "小区内部路，夜间相对安静；动线利于室友白天补觉",
        petPolicy: "房东口头同意猫；合同模板未写宠物条款（须补书面）",
        contractRisk: "提前退租违约金 2 个月租金（偏高）",
        moveInDate: "5/25 可入住",
        roommateFit: "两居空间足，协调空间大",
      },
      B: {
        name: "市区老小区·一居改两居",
        rent: "6100/月（含物业与网费）",
        commute: "地铁+步行约 35 分钟",
        light: "客厅采光一般；次卧几乎无直射光",
        noise: "临路，白天车流可闻；室友白天补觉需评估",
        petPolicy: "宠物条款表述模糊，需修订为明确文本",
        contractRisk: "违约金约 1 个月租金（待合同核实）",
        moveInDate: "6/1 当天可交接",
        roommateFit: "次卧小，作息冲突摩擦成本上升",
      },
      C: {
        name: "近地铁公寓·合租主卧",
        rent: "5800/月（主卧，包物业）",
        commute: "步行+地铁约 25 分钟",
        light: "主卧朝南，采光好",
        noise: "公区与隔壁墙薄，白天噪音风险需核验",
        petPolicy: "公寓规定禁止宠物；与硬约束冲突风险高",
        contractRisk: "格式合同，违约金与扣押金偏严",
        moveInDate: "5/28 可入住",
        roommateFit: "合租需确认公区与室友规则",
      },
      D: {
        name: "商务楼改建·整租一居",
        rent: "6200/月（顶格，含物业网费）",
        commute: "约 30 分钟",
        light: "大面积窗，采光稳定",
        noise: "楼下商业，夜间偶有清运/货运（待实测）",
        petPolicy: "可提供书面补充协议写入宠物条款",
        contractRisk: "商业改建性质，合规与退租条款复杂",
        moveInDate: "5/30 可入住",
        roommateFit: "一居紧凑，作息协调要求高",
      },
    },
  },
  hiddenInfo: [
    {
      triggerKeywords: ["隔音", "噪音", "吵", "安静", "声音"],
      data: {
        "apartments.A.soundInsulation": "隔音一般，近内部路但夜间相对安静",
        "apartments.B.soundInsulation": "临路，白天噪音对补觉敏感者需实测",
        "apartments.C.soundInsulation": "公区/隔壁墙薄，白天风险偏高",
        "apartments.D.soundInsulation": "商业楼下，夜间偶发噪音需实测",
      },
    },
    {
      triggerKeywords: ["停车", "车位", "开车", "自驾"],
      data: {
        "apartments.A.parking": "小区车位紧张，以物业口径为准",
        "apartments.B.parking": "老小区停车位有限，需核实月租/临停",
        "apartments.C.parking": "公寓车位规则以管理处为准",
        "apartments.D.parking": "商务区停车成本通常较高，需核实",
      },
    },
    {
      triggerKeywords: ["合同", "押金", "违约", "租期"],
      data: {
        "apartments.A.leaseNotes": "标准模板；提前退租违约金偏高，细节以文本为准",
        "apartments.B.leaseNotes": "房东愿签补充协议；违约金约 1 个月（待核实）",
        "apartments.C.leaseNotes": "公寓格式合同，扣押金/违约金条款偏严",
        "apartments.D.leaseNotes": "商业改建退租条件复杂，建议全文审阅",
      },
    },
  ],
  probeOverrides: apartmentScenarioProbes,
});

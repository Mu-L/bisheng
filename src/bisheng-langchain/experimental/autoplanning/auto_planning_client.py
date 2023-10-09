import os
import json
import requests


def auto_planning_client(skill, task_desc, save_file):
    data = {'skill': skill, 'task_desc': task_desc}
    res = requests.post('http://{}:{}/auto_planning_v1'.format('192.168.106.12', 9118), json=data).text
    # str -> json
    res = eval(res)

    if 'code' in res and res['code'] == '200':
        agent_graph = res['data']
        with open(save_file, 'w') as f:
            json.dump(agent_graph, f, ensure_ascii=False, indent=2)
    else:
        print(res.text)


skill = "创建个知识库问答系统"
task_desc = "1、选择知识库，对知识库进行问答。"

# skill = "创建个文件问答系统"
# task_desc = "1、上传PDF文件，并对文件内容进行问答。"

# skill = "创建个大模型对话系统"
# task_desc = "1、跟大模型进行对话。"

# skill = "创建个csv文件分析系统"
# task_desc = "1、对csv文件进行问答"

# skill = "创建个合同审核系统"
# task_desc = "1、上传合同pdf文件并对合同内容进行查询问答；2、当涉及到合同数值计算问题时，请调用计算器工具；3、当涉及到需要查外部信息时，请调用搜索引擎工具；"

# skill = "创建个财报分析系统"
# task_desc = "1、上传财报pdf文件并对财报内容进行问答；2、当涉及到数值计算问题时，请调用计算器工具；3、当涉及到保荐机构信息时，可以查询保荐机构csv相关文件；4、当涉及到查询股票信息时，请查询对应的sql文件"

save_file = os.path.join('/Users/gulixin/Desktop', skill + '.json')
auto_planning_client(skill, task_desc, save_file)
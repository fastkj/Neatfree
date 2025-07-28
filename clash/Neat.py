## python Neat.py 
import requests
import os

# 需要下载的文件及其原始GitHub链接
files = [
    {
        "url": "https://github.com/Barabama/FreeNodes/blob/main/nodes/nodefree.yaml",
    }, 
    {
        "url": "https://github.com/Barabama/FreeNodes/blob/main/nodes/v2rayshare.yaml",
    },
    {
        "url": "https://github.com/Barabama/FreeNodes/blob/main/nodes/ndnode.yaml",
    },  
    {
        "url": "https://github.com/free18/v2ray/blob/main/c.yaml",
    },


]

def github_raw_url(github_url):
    """
    将GitHub网页文件链接转换为raw文件直链
    """
    if 'github.com' in github_url and '/blob/' in github_url:
        raw_url = github_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
        return raw_url
    return github_url


def download_file(url, filename, save_dir="."):
    raw_url = github_raw_url(url)
    print(f"正在下载: {raw_url}")
    try:
        response = requests.get(raw_url, timeout=20)
        response.raise_for_status()
        file_path = os.path.join(save_dir, filename)
        with open(file_path, 'wb') as f:
            f.write(response.content)
        print(f"已保存为: {file_path}")
    except Exception as e:
        print(f"下载失败: {url}\n错误: {e}")


def main():
    save_dir = os.path.dirname(os.path.abspath(__file__))

    # 先删除多余的 Neat_configX.yml 文件
    existing = [f for f in os.listdir(save_dir) if f.startswith("Neat_config") and f.endswith(".yml")]
    needed = [f"Neat_config{idx}.yml" for idx in range(1, len(files)+1)]
    for f in existing:
        if f not in needed:
            os.remove(os.path.join(save_dir, f))
            print(f"已删除多余文件: {f}")

    # 正常下载
    for idx, file in enumerate(files, start=1):
        filename = f"Neat_config{idx}.yml"
        download_file(file["url"], filename, save_dir)

if __name__ == "__main__":
    main() 

    # 自动更新 index.html 的更新时间（带调试输出）
    from datetime import datetime
    import re
    html_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'index.html'))
    print("尝试写入更新时间到：", html_path)
    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
        if 'id="update-time"' in html:
            html = re.sub(r'<div id="update-time">.*?</div>', f'<div id="update-time">更新时间：{now}</div>', html, flags=re.DOTALL)
        else:
            html = html.replace(
                '<header>',
                '<header>\n        <div id="update-time">更新时间：{}</div>'.format(now)
            )
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html)
        print("更新时间写入成功！")
    except Exception as e:
        print("写入 index.html 失败：", e) 

    # 自动生成订阅源卡片并写入 index.html
    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            html = f.read()
        cards = []
        for idx, _ in enumerate(files, start=1):
            cards.append(f'''
<div class="glass-card">
  <h2>Clash 订阅源 {idx}</h2>
  <pre id="sub{idx}">https://clash.fastkj.eu.org/clash/Neat_config{idx}.yml</pre>
  <button class="btn" onclick="copyToClipboard('sub{idx}')">复制Clash 订阅源</button>
</div>
''')
        cards_html = '\n'.join(cards)
        import re
        html, n = re.subn(
            r'<!-- SUBSCRIPTION_START -->(.*?)<!-- SUBSCRIPTION_END -->',
            f'<!-- SUBSCRIPTION_START -->\n{cards_html}\n<!-- SUBSCRIPTION_END -->',
            html,
            flags=re.DOTALL
        )
        if n == 0:
            print("未找到订阅源标记区域，未写入卡片。请检查 index.html 是否有正确的标记。")
        else:
            with open(html_path, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"已自动生成 {len(files)} 个订阅源卡片！")
    except Exception as e:
        print("写入订阅源卡片失败：", e) 


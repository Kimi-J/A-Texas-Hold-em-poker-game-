# 德州扑克游戏

这是一个基于Flask的图形化德州扑克游戏，支持任意数量好友本地在一台电脑上交替轮流加注的玩法，无AI玩家。
是本人高中生业余开发的项目，开发周期不长，多多包涵。

This is a Flask-based graphical Texas Hold'em game that supports local multiplayer for any number of friends on a single computer, where players take turns betting and raising. There are no AI players.
This is a hobby project developed by a high school student with a short development cycle, so please excuse any rough edges.

## 功能

- 自动发牌
- 玩家操作：加注、跟注、弃牌
- 美观的发牌、加注、计分板界面
- 扑克牌真实花纹贴图

## 运行指南

1. **安装依赖**

   确保你已经安装了Python。然后，安装项目所需的Python库：

   ```bash
   pip install -r requirements.txt
   ```

2. **准备扑克牌图片**

   在 `static/images/cards/` 目录下放置扑克牌的图片资源。图片命名应遵循一定的规则，例如：`2_of_clubs.png`, `ace_of_spades.png` 等，以便在JavaScript中动态加载。
   例如，这里放置的是来自开源项目https://gitcode.com/open-source-toolkit/77d38/tree/main的图片

3. **运行应用**

   ```bash
   python app.py
   ```

4. **访问游戏**

   在浏览器中打开 `http://127.0.0.1:5000/` 即可访问游戏界面。

## 项目结构

```
.  
├── app.py              # Flask 应用主文件
├── requirements.txt    # Python 依赖
├── README.md           # 项目说明
├── static/
│   ├── css/
│   │   └── style.css   # 样式文件
│   ├── js/
│   │   └── game.js     # 游戏逻辑文件
│   └── images/
│       └── cards/      # 扑克牌图片存放目录
└── templates/
    └── index.html      # 游戏主页面模板
```
# 図解SVGの生成スクリプト(第2弾)。使い方: python figures/_gen2.py (リポジトリのルートで実行)
import html
def esc(s): return html.escape(s, quote=False)
class Fig:
    def __init__(s, name, w, h, label):
        s.name, s.w, s.h, s.label, s.p = name, w, h, label, []
    def box(s, x, y, w, h, title, lines=(), cls='b', tsize=18, dsize=14.5):
        s.p.append(f'<rect class="{cls}" x="{x}" y="{y}" width="{w}" height="{h}" rx="10"/>')
        cx = x + w / 2
        ty = y + 26 if lines else y + h / 2 + 6
        s.p.append(f'<text class="bt" x="{cx}" y="{ty}" text-anchor="middle" font-size="{tsize}">{esc(title)}</text>')
        for i, l in enumerate(lines):
            s.p.append(f'<text class="bd" x="{cx}" y="{y+50+i*19}" text-anchor="middle" font-size="{dsize}">{esc(l)}</text>')
    def arrow(s, x1, y1, x2, y2, dash=False):
        s.p.append(f'<line class="ar{" da" if dash else ""}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" marker-end="url(#ah-{s.name})"/>')
    def text(s, x, y, t, size=14.5, anchor='start', cls='bd'):
        s.p.append(f'<text class="{cls}" x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}">{esc(t)}</text>')
    def out(s):
        head = (f'<svg class="figsvg" viewBox="0 0 {s.w} {s.h}" role="img" aria-label="{esc(s.label)}" xmlns="http://www.w3.org/2000/svg">'
                f'<defs><marker id="ah-{s.name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ah" d="M0 0L10 5L0 10z"/></marker></defs>')
        open(f'figures/{s.name}.svg', 'w', encoding='utf8').write(head + ''.join(s.p) + '</svg>')

# AHTの内訳
f = Fig('aht-breakdown', 700, 330, 'AHT(平均処理時間)の計算。通話時間、保留時間、後処理時間を足した合計を、通話件数で割る。')
f.box(10, 20, 170, 80, '通話時間')
f.text(195, 66, '＋', 22, 'middle', 'bt')
f.box(210, 20, 170, 80, '保留時間')
f.text(395, 66, '＋', 22, 'middle', 'bt')
f.box(410, 20, 280, 80, '後処理時間(ACW)', ['通話後の記録・分類・CRM更新など'], 'b', 18, 14.5)
f.arrow(350, 104, 350, 146)
f.box(150, 150, 400, 60, '合計 ÷ 通話件数 = AHT', [], 'b head', 19)
f.text(10, 246, '・後処理の間、オペレーターは次の問い合わせを受けられない')
f.text(10, 270, '・AHTは短いほど良いとは限らない。一次解決率や顧客満足度とあわせて見る')
f.text(10, 296, '※一般的な計算式。通話時間の範囲などは、会社や製品によって異なることがある', 13.5)
f.out()

# インバウンド/アウトバウンドの比較
f = Fig('inout-compare', 700, 428, 'インバウンドとアウトバウンドの比較。業務の例、顧客との距離、研修の期間、指標の4つの観点で並べた表。')
f.box(130, 10, 270, 50, 'インバウンド(受信)', [], 'b head', 18)
f.box(420, 10, 270, 50, 'アウトバウンド(発信)', [], 'b head2', 18)
rows = [
 ('業務の例', ['問い合わせ、申し込み、', '受注、クレーム'], ['新商品の案内、アポ獲得、', 'フォロー、アンケート']),
 ('顧客との距離', ['近い傾向', '(顧客から連絡してくる)'], ['遠い', '(相手は関心がないことが多い)']),
 ('研修の期間', ['長くなる傾向'], ['短期間で済むことが多い']),
 ('指標の例', ['応答率、顧客満足度'], ['架電数、アポ獲得率、成約率']),
]
y = 76
for lab, a, b in rows:
    h = 78 if len(a) > 1 or len(b) > 1 else 56
    f.text(10, y + h / 2 + 5, lab, 15, 'start', 'bt')
    for x, ls in ((130, a), (420, b)):
        f.p.append(f'<rect class="b" x="{x}" y="{y}" width="270" height="{h}" rx="10"/>')
        for i, l in enumerate(ls):
            ty = y + h / 2 + 5 - (len(ls) - 1) * 10 + i * 20
            f.p.append(f'<text class="bd" x="{x+135}" y="{ty}" text-anchor="middle" font-size="14.5">{esc(l)}</text>')
    y += h + 12
f.text(10, 414, '※1社の解説による整理。調査に基づく数値ではない', 13.5)
f.out()

# 在宅の方式
f = Fig('remote-methods', 700, 440, '総務省のテレワーク7方式。端末にデータを残さない4方式(リモートデスクトップ、VDI、セキュアコンテナ、セキュアブラウザ)と、残りうる3方式(VPN、クラウドサービス、スタンドアロン)。')
f.box(10, 10, 330, 50, '端末にデータを残さない方式', [], 'b head', 17)
f.box(360, 10, 330, 50, '端末にデータが残りうる方式', [], 'b head2', 17)
L = [('リモートデスクトップ', 'オフィスのPCを遠隔操作する'), ('仮想デスクトップ(VDI)', '仮想デスクトップ基盤を遠隔操作する'), ('セキュアコンテナ', '端末内の独立した仮想環境で動かす'), ('セキュアブラウザ', '特殊なブラウザで社内システムに接続')]
R = [('VPN', 'VPNでオフィスのネットワークに接続する'), ('クラウドサービス', 'クラウドサービスに直接接続する'), ('スタンドアロン', 'あらかじめ保存したデータで作業する')]
for i, (t, d) in enumerate(L): f.box(10, 76 + i * 66, 330, 56, t, [d], 'b', 17)
for i, (t, d) in enumerate(R): f.box(360, 76 + i * 66, 330, 56, t, [d], 'b', 17)
f.text(360, 300, '→ 端末の暗号化と、遠隔でのデータ消去が重要', 14.5, 'start', 'bt')
f.text(10, 360, '・個人所有の端末(BYOD)は、マルウェア対策などを強制できず、十分に統制できない。', 14)
f.text(10, 382, '  リスクを受け入れられるか評価したうえで、使ってよいかを決める', 14)
f.text(10, 428, '※総務省「テレワークセキュリティガイドライン」第5版(令和3年5月)の7方式', 13.5)
f.out()

# 漏えい報告の期限
f = Fig('breach-timeline', 700, 360, '個人データの漏えい等の報告期限。発覚から3〜5日以内が目安で速報、30日以内に確報(不正の目的の場合は60日以内)。報告の対象は4つの場合。')
f.p.append('<line class="ar" x1="30" y1="90" x2="676" y2="90" marker-end="url(#ah-breach-timeline)"/>')
for x, t, d in ((50, '発覚', ''), (230, '速報', '3〜5日以内が目安'), (430, '確報', '30日以内'), (600, '確報', '60日以内')):
    f.p.append(f'<circle class="dot" cx="{x}" cy="90" r="7"/>')
    f.text(x, 62, t, 17, 'middle', 'bt')
    if d: f.text(x, 124, d, 14.5, 'middle')
f.text(600, 144, '(不正の目的がある場合)', 13, 'middle')
f.text(10, 176, '報告の対象になる場合(次のいずれか)', 15, 'start', 'bt')
cases = ['要配慮個人情報が', '財産的被害の', '不正の目的の', '本人が1,000人を']
cases2 = ['含まれる', 'おそれがある', 'おそれがある', '超える']
for i in range(4):
    x = 10 + i * 172
    f.p.append(f'<rect class="b" x="{x}" y="190" width="160" height="80" rx="10"/>')
    f.text(x + 80, 224, cases[i], 14.5, 'middle')
    f.text(x + 80, 246, cases2[i], 14.5, 'middle')
f.text(10, 302, '・上の場合の漏えい等(またはそのおそれ)が起きたら、報告と本人への通知が義務', 14)
f.text(10, 326, '・上の「日数」は発覚日から数える。目盛りは正確な縮尺ではない', 14)
f.text(10, 350, '※個人情報保護委員会の案内をもとにした図。最新の案内は、委員会のページで確認が必要', 13)
f.out()

# ダイヤルインと代表組
f = Fig('dialin-vs-group', 700, 340, 'ダイヤルインと代表組の違い。ダイヤルインは1本の回線を複数の番号に振り分ける。代表組は複数の回線を1つの代表番号にまとめる。')
f.box(10, 10, 330, 44, 'ダイヤルイン', [], 'b head', 18)
f.box(360, 10, 330, 44, '代表組', [], 'b head2', 18)
# 左: 1回線 → 複数番号
f.box(10, 110, 110, 70, '1本の回線', [], 'b', 16)
for i, n in enumerate(['番号A → 営業部', '番号B → 経理部', '番号C → 総務部']):
    f.box(180, 70 + i * 52, 160, 44, n, [], 'b', 14.5)
    f.arrow(122, 145, 176, 92 + i * 52)
f.text(10, 250, '1つの回線を、複数の番号に振り分ける', 14.5, 'start', 'bt')
f.text(10, 274, '・番号ごとに、担当者が直接受ける', 14)
f.text(10, 296, '・回線を増やすより、費用を抑えやすい', 14)
# 右: 複数回線 → 1番号
f.box(360, 110, 120, 70, '代表番号', [], 'b', 16)
for i in range(3):
    f.box(560, 70 + i * 52, 130, 44, f'回線{i+1}', [], 'b', 14.5)
    f.arrow(482, 145, 556, 92 + i * 52)
f.text(360, 250, '複数の回線を、1つの番号にまとめる', 14.5, 'start', 'bt')
f.text(360, 274, '・空いている回線で応答する', 14)
f.text(360, 296, '・通話中になりにくい。顧客相談窓口などで使われる', 14)
f.text(10, 328, '※NTT東日本のコラムの整理。番号や部署の名前は例', 13.5)
f.out()

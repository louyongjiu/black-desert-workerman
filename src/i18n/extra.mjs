export const common = `
, that λ¦，使 λ¦, где λ¦, 조건 λ¦、条件 λ
Bin 0 has 1-λ ≈¦區間 0 的 1−λ ≈¦Интервал 0: 1−λ ≈¦구간 0의 1−λ ≈¦区間0の1−λ ≈
r1 ~ Uniform(¦r1 ~ 均勻分布（¦r1 ~ Равномерное(¦r1 ~ 균등 분포(¦r1 ~ 一様分布（
r2 ~ Uniform(¦r2 ~ 均勻分布（¦r2 ~ Равномерное(¦r2 ~ 균등 분포(¦r2 ~ 一様分布（
r3 ~ Uniform(¦r3 ~ 均勻分布（¦r3 ~ Равномерное(¦r3 ~ 균등 분포(¦r3 ~ 一様分布（
covers observed range¦涵蓋觀測範圍¦Покрывает наблюдаемый диапазон¦관측 범위 포함¦観測範囲を含む
does not cover observed range¦未涵蓋觀測範圍¦Не покрывает наблюдаемый диапазон¦관측 범위 미포함¦観測範囲を含まない
FAILED¦失敗¦Ошибка¦실패¦失敗
full cost of this node + Σ of connection nodes costs shared proportionally between all active jobs using them¦此節點完整成本＋依收益比例分攤的連接節點成本總和¦Стоимость узла + сумма связей, разделённых пропорционально между активными работами¦거점 전체 비용 + 활성 작업에 비례 분배된 연결 비용 합계¦この拠点費＋稼働作業で比例配分した接続費の合計
random to max¦隨機升至滿級¦Случайное повышение до максимума¦무작위로 최대 레벨¦ランダムに最大レベルへ
Dataset:¦資料集：¦Набор данных:¦데이터:¦データ：
size N =¦樣本數 N＝¦Размер N =¦표본 수 N =¦標本数 N＝
min =¦最小值＝¦Мин. =¦최소 =¦最小＝
max =¦最大值＝¦Макс. =¦최대 =¦最大＝
model¦模型¦Модель¦모델¦モデル
observed¦觀測值¦Наблюдения¦관측값¦観測値
observed-error¦觀測誤差¦Ошибка наблюдений¦관측 오차¦観測誤差
obs.personal¦個人觀測¦Личные наблюдения¦개인 관측¦個人観測
obs.region¦地區觀測¦Наблюдения региона¦지역 관측¦地域観測
updates¦刷新次數¦Обновления¦갱신 횟수¦更新回数
resource¦資源¦Ресурсы¦자원¦資源
distribution¦分布¦Распределение¦분포¦分布
housing:¦住房：¦Жильё:¦주거:¦住宅：
lodging:¦宿舍：¦Жильё:¦숙소:¦宿舎：
storage:¦倉庫：¦Склад:¦창고:¦倉庫：
old:¦原先：¦До:¦이전:¦変更前：
new:¦變更後：¦После:¦이후:¦変更後：
Missing required market prices¦缺少必要的市場價格¦Отсутствуют необходимые рыночные цены¦필수 시장 가격 누락¦必要な市場価格がありません
Choose file¦選擇檔案¦Выбрать файл¦파일 선택¦ファイルを選択
No file selected¦尚未選擇檔案¦Файл не выбран¦선택한 파일 없음¦ファイル未選択
Failed to fetch¦無法取得資料¦Не удалось получить данные¦데이터 가져오기 실패¦データを取得できません
BDOlytics market request failed: {error}¦BDOlytics 市場請求失敗：{error}¦Ошибка запроса рынка BDOlytics: {error}¦BDOlytics 시장 요청 실패: {error}¦BDOlytics市場リクエスト失敗：{error}
BDOlytics market response has an unexpected format¦BDOlytics 市場回應格式不符¦Неверный формат ответа рынка BDOlytics¦BDOlytics 시장 응답 형식 오류¦BDOlytics市場応答の形式が不正です
`;
export const optimizer = `
更新价格中…¦Updating prices…¦正在更新價格…¦Обновление цен…¦가격 갱신 중…¦価格を更新中…
更新价格¦Update prices¦更新價格¦Обновить цены¦가격 갱신¦価格を更新
价格更新于 {date}¦Prices updated {date}¦價格更新於 {date}¦Цены обновлены {date}¦가격 갱신 {date}¦価格更新 {date}
使用当前缓存与自定义价格；缺价的采集点会跳过。¦Using cached and custom prices; sites with missing prices are skipped.¦使用目前快取與自訂價格；缺少價格的採集點會跳過。¦Используются сохранённые и свои цены; узлы без цен пропускаются.¦캐시 및 사용자 지정 가격 사용, 가격 없는 거점 제외.¦キャッシュ・カスタム価格を使用。価格のない拠点は除外。
当前已应用的方案¦Currently applied plan¦目前已套用方案¦Применённый план¦현재 적용한 계획¦現在適用中の計画
方案预览¦Plan preview¦方案預覽¦Предпросмотр плана¦계획 미리보기¦計画プレビュー
`;

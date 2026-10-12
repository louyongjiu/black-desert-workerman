export default `
Housing planner¦住房規劃¦Планирование жилья¦주택 계획¦住宅プランナー
Plan lodging and storage while keeping reserved house uses. Each rented house is counted once.¦保留指定房屋用途，規劃住宿與倉庫。每棟租用房屋只計費一次。¦Планируйте жильё и склад, сохраняя закреплённые назначения домов. Каждый арендованный дом учитывается один раз.¦지정된 주택 용도를 유지하며 숙소와 창고를 계획합니다. 각 임대 주택 비용은 한 번만 계산됩니다.¦指定した用途を維持しながら宿泊施設と倉庫を計画します。借りた住宅の費用は一度だけ計上します。
Reserved house uses¦保留房屋用途¦Закреплённые назначения домов¦유지할 주택 용도¦維持する住宅用途
Working workshops are reserved automatically. Other houses can keep a selected use.¦正在運作的工坊會自動保留。其他房屋可鎖定指定用途。¦Работающие мастерские закрепляются автоматически. Для остальных домов можно сохранить выбранное назначение.¦가동 중인 공방은 자동으로 유지됩니다. 다른 주택도 선택한 용도를 고정할 수 있습니다.¦稼働中の工房は自動で確保されます。他の住宅も用途を固定できます。
Keep this use¦保留此用途¦Сохранить назначение¦이 용도 유지¦この用途を維持
Working workshop¦運作中的工坊¦Работающая мастерская¦가동 중인 공방¦稼働中の工房
Automatic workshop reservation¦自動保留工坊¦Автоматически закреплённая мастерская¦공방 자동 유지¦工房を自動で確保
Available for planning¦可自由規劃¦Доступен для планирования¦자유롭게 계획¦自由に計画
Undo housing change¦復原住房變更¦Отменить изменение жилья¦주택 변경 되돌리기¦住宅の変更を元に戻す
Clear all manual house reservations¦清除所有手動保留的房屋用途¦Снять все ручные закрепления домов¦모든 수동 주택 용도 고정 해제¦手動で固定した住宅用途をすべて解除
Required beds from houses¦房屋需提供的床位¦Требуемые места в домах¦주택에서 필요한 숙소 수¦住宅で必要な宿泊枠
Required storage from houses¦房屋需提供的倉庫格數¦Требуемые ячейки в домах¦주택에서 필요한 창고 칸¦住宅で必要な倉庫枠
Use current empire needs¦使用目前帝國需求¦Использовать текущие потребности империи¦현재 제국 필요량 사용¦現在の帝国の必要量を使用
These requirements are supplied by rented houses. Current empire needs already deduct free and paid capacity.¦上述需求由租用房屋提供。目前帝國需求已扣除免費及付費擴充容量。¦Эти потребности покрываются арендованными домами. В текущих потребностях империи уже вычтена бесплатная и платная вместимость.¦이 필요량은 임대 주택으로 충족합니다. 현재 제국 필요량에는 무료 및 유료 확장 용량이 이미 반영되어 있습니다.¦この必要量は借りた住宅で確保します。現在の帝国の必要量からは無料枠と有料拡張枠が差し引かれています。
Calculating housing¦正在計算住房¦Расчёт жилья¦주택 계산 중¦住宅を計算中
Calculating housing at {town}¦正在計算 {town} 的住房¦Расчёт жилья: {town}¦{town} 주택 계산 중¦{town} の住宅を計算中
Stop housing calculation¦停止住房計算¦Остановить расчёт жилья¦주택 계산 중지¦住宅の計算を停止
Retry housing calculation¦重新計算住房¦Повторить расчёт жилья¦주택 다시 계산¦住宅を再計算
Feasible housing plan; minimum cost has not been proved.¦此方案可行，尚未證明成本最低。¦План допустим, но минимальная стоимость ещё не доказана.¦실행 가능한 계획이며 최소 비용은 아직 확인되지 않았습니다.¦実行可能な計画です。最小費用はまだ証明されていません。
Minimum housing cost for these requirements and reservations.¦在目前需求及保留用途下，住房成本最低。¦Минимальная стоимость жилья при этих потребностях и закреплениях.¦현재 필요량과 고정 용도에 대한 최소 주택 비용입니다.¦現在の必要量と固定用途に対する最小住宅費用です。
Save housing plan¦儲存住房方案¦Сохранить план жилья¦주택 계획 저장¦住宅計画を保存
Saving records this plan in Workerman. It does not rent houses in the game.¦儲存會在 Workerman 記錄此方案，不會在遊戲內租用房屋。¦Сохранение записывает план в Workerman, но не арендует дома в игре.¦저장하면 Workerman에 계획이 기록됩니다. 게임에서 주택을 임대하지는 않습니다.¦保存すると Workerman に計画を記録します。ゲーム内で住宅を借りる操作は行いません。
Housing plan saved¦已儲存住房方案¦План жилья сохранён¦주택 계획 저장됨¦住宅計画を保存しました
Compared with saved housing plan¦與已儲存住房方案比較¦По сравнению с сохранённым планом¦저장된 주택 계획과 비교¦保存した住宅計画との比較
Rent these houses¦需要租用的房屋¦Арендовать эти дома¦임대할 주택¦借りる住宅
Release these houses¦可以退租的房屋¦Освободить эти дома¦반납할 주택¦返却する住宅
Change these house uses¦需要變更用途的房屋¦Изменить назначение этих домов¦용도를 변경할 주택¦用途を変更する住宅
Prerequisite house¦前置房屋¦Предшествующий дом¦선행 주택¦前提となる住宅
Housing and reserved houses:¦住房與保留房屋：¦Жильё и закреплённые дома:¦숙소 및 유지 주택:¦住宅と確保した建物：
Shared prerequisite houses are counted once in housing costs.¦共用前置房屋只在住房成本中計費一次。¦Общие предшествующие дома учитываются в расходах на жильё один раз.¦공유 선행 주택 비용은 주택 비용에 한 번만 포함됩니다.¦共通の前提住宅は住宅費用に一度だけ計上します。
Reserved house uses are included in the housing budget.¦保留用途的房屋已計入住房預算。¦Дома с закреплённым назначением включены в бюджет жилья.¦용도를 유지하는 주택이 주택 예산에 포함됩니다.¦用途を固定した住宅も住宅予算に含まれます。
No housing plan satisfies these reservations¦沒有符合保留用途及需求的住房方案¦Нет плана жилья, удовлетворяющего этим закреплениям¦고정 용도와 필요량을 충족하는 주택 계획이 없습니다¦固定用途と必要量を満たす住宅計画がありません
No housing plan found within the time limit¦時限內未找到可行住房方案¦За отведённое время допустимый план жилья не найден¦제한 시간 내에 실행 가능한 주택 계획을 찾지 못했습니다¦制限時間内に実行可能な住宅計画が見つかりませんでした
Housing calculation stopped¦住房計算已停止¦Расчёт жилья остановлен¦주택 계산 중지됨¦住宅の計算を停止しました
Housing solver could not be loaded¦無法載入住房計算器¦Не удалось загрузить решатель жилья¦주택 계산기를 불러올 수 없습니다¦住宅ソルバーを読み込めませんでした
Housing settings changed; calculate again¦住房設定已變更，請重新計算¦Настройки жилья изменились; повторите расчёт¦주택 설정이 변경되었습니다. 다시 계산하세요¦住宅設定が変わりました。再計算してください
House reservation is invalid: {house}¦房屋用途鎖定無效：{house}¦Недопустимое закрепление дома: {house}¦잘못된 주택 용도 고정: {house}¦住宅の用途固定が無効です：{house}
Workshop house is invalid: {house}¦工坊房屋無效：{house}¦Недопустимый дом мастерской: {house}¦잘못된 공방 주택: {house}¦工房の住宅が無効です：{house}
House is reserved for another use: {house}¦房屋已保留其他用途：{house}¦Дом закреплён для другого назначения: {house}¦다른 용도로 고정된 주택: {house}¦別の用途に固定された住宅です：{house}
Invalid housing level: {house}¦房屋等級無效：{house}¦Недопустимый уровень дома: {house}¦잘못된 주택 단계: {house}¦住宅の段階が無効です：{house}
Invalid house cost: {house}¦房屋貢獻點資料無效：{house}¦Недопустимая стоимость дома: {house}¦잘못된 주택 공헌도: {house}¦住宅の貢献度が無効です：{house}
House dependency cycle: {house}¦房屋前置關係出現循環：{house}¦Цикл зависимостей домов: {house}¦주택 선행 관계 순환: {house}¦住宅の前提関係が循環しています：{house}
House dependency is missing: {house}¦房屋前置資料缺失：{house}¦Отсутствует зависимость дома: {house}¦주택 선행 정보 누락: {house}¦住宅の前提情報がありません：{house}
Housing result is invalid¦住房結果無效¦Недопустимый результат расчёта жилья¦잘못된 주택 계산 결과¦住宅の計算結果が無効です
Housing dependencies are incomplete¦住房前置關係不完整¦Зависимости жилья неполны¦주택 선행 관계가 완전하지 않습니다¦住宅の前提関係が不完全です
Housing result conflicts with a reservation¦住房方案與保留用途衝突¦План жилья противоречит закреплению¦주택 계획이 고정 용도와 충돌합니다¦住宅計画が固定用途と競合しています
Housing capacity is insufficient¦住房或倉庫容量不足¦Недостаточная вместимость жилья или склада¦숙소 또는 창고 용량 부족¦宿泊枠または倉庫枠が不足しています
Housing totals do not match¦住房容量或成本合計不一致¦Итоги жилья не совпадают¦주택 용량 또는 비용 합계 불일치¦住宅の容量または費用の合計が一致しません
Housing demand is invalid¦住房需求無效¦Недопустимая потребность в жилье¦잘못된 주택 필요량¦住宅の必要量が無効です
The budget includes nodes, lodging, storage and reserved houses. Fences, workshop production, custom jobs and trade tasks are not optimized.¦預算包含節點、住宿、倉庫及保留用途的房屋。不最佳化柵欄、工坊生產、自訂任務和貿易任務。¦Бюджет включает узлы, жильё, склад и закреплённые дома. Заборы, производство мастерских, свои работы и торговля не оптимизируются.¦예산에는 거점, 숙소, 창고와 유지할 주택이 포함됩니다. 울타리, 공방 생산, 사용자 지정 작업과 무역 작업은 최적화하지 않습니다.¦予算には拠点、宿泊施設、倉庫、用途を固定した住宅を含みます。フェンス、工房生産、カスタム作業、貿易は最適化しません。
Workshop routes and material storage are not included automatically. This preview plans gathering workers.¦工坊路線與材料倉儲不會自動計入。此預覽規劃採集工人。¦Маршруты мастерских и хранение материалов не включаются автоматически. Этот предварительный план предназначен для рабочих добычи.¦공방 경로와 재료 창고는 자동으로 포함되지 않습니다. 이 미리보기는 생산 거점 일꾼을 계획합니다.¦工房への経路と材料の倉庫枠は自動では含まれません。このプレビューは採集労働者の計画です。
`;

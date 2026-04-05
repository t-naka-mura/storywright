import { useEffect, useRef, useState } from "react";
import {
  RecordIcon, StopIcon, CheckIcon, PlayIcon, HourglassIcon,
} from "./Icons";

type HelpSection =
  | "getting-started"
  | "recording"
  | "assertion"
  | "running"
  | "managing"
  | "environment";

const sections: { id: HelpSection; label: string }[] = [
  { id: "getting-started", label: "はじめに" },
  { id: "recording", label: "録画する" },
  { id: "assertion", label: "アサーションを追加する" },
  { id: "running", label: "テストを実行する" },
  { id: "managing", label: "ストーリーを管理する" },
  { id: "environment", label: "環境変数を使う" },
];

export function HelpPanel() {
  const [activeSection, setActiveSection] = useState<HelpSection>("getting-started");
  const contentRef = useRef<HTMLDivElement>(null);
  const isClickScrolling = useRef(false);

  // IntersectionObserver でスクロール位置に応じてナビをハイライト
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isClickScrolling.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id as HelpSection);
            break;
          }
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 },
    );

    for (const section of sections) {
      const el = container.querySelector(`#${section.id}`);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  const handleNavClick = (id: HelpSection) => {
    setActiveSection(id);
    const el = contentRef.current?.querySelector(`#${id}`);
    if (!el) return;
    isClickScrolling.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => { isClickScrolling.current = false; }, 600);
  };

  return (
    <section className="help-panel" aria-label="Help">
      <div className="help-layout">
        <aside className="help-nav" aria-label="Help sections">
          <div className="settings-nav-header">
            <div className="settings-nav-eyebrow">Storywright</div>
            <h1 className="settings-panel-title">Help</h1>
          </div>
          <nav className="settings-nav-list">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`settings-nav-item ${activeSection === section.id ? "settings-nav-item-active" : ""}`}
                aria-current={activeSection === section.id ? "page" : undefined}
                onClick={() => handleNavClick(section.id)}
              >
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="help-content" ref={contentRef}>
            {/* はじめに */}
            <div id="getting-started" className="help-section">
              <h2 className="help-section-title">はじめに</h2>
              <p className="help-paragraph">
                Storywright は、ブラウザ操作を録画して、そのまま E2E テストとして実行できるデスクトップアプリです。
              </p>
              <h3 className="help-subtitle">基本の流れ</h3>
              <ol className="help-steps">
                <li>
                  <strong>URL を入力</strong> — アドレスバーにテスト対象のサイトの URL を入力して Enter を押します。
                </li>
                <li>
                  <strong>録画する</strong> — ツールバーの <span className="help-inline-icon"><RecordIcon /></span> <strong>REC</strong> ボタンを押して、サイト上でクリックや入力などの操作をします。操作は自動的に記録されます。
                </li>
                <li>
                  <strong>テストを実行する</strong> — <span className="help-inline-icon"><StopIcon /></span> <strong>Stop</strong> で録画を終了し、右パネルの <span className="help-inline-icon"><PlayIcon /></span> <strong>Run</strong> ボタンでテストを実行します。各ステップの成功・失敗が表示されます。
                </li>
              </ol>
            </div>

            {/* 録画する */}
            <div id="recording" className="help-section">
              <h2 className="help-section-title">録画する</h2>
              <h3 className="help-subtitle">録画の開始と終了</h3>
              <ol className="help-steps">
                <li>アドレスバーにテスト対象の URL を入力して Enter を押します。</li>
                <li>ツールバーの <span className="help-inline-icon"><RecordIcon /></span> <strong>REC</strong> ボタンを押します。画面上部に「録画中」バッジが表示されます。</li>
                <li>プレビューエリアでサイトを操作します。クリック・テキスト入力・ページ遷移・セレクトボックスの選択が自動的に記録されます。</li>
                <li>操作が終わったら <span className="help-inline-icon"><StopIcon /></span> <strong>Stop</strong> ボタンを押します。</li>
              </ol>
              <h3 className="help-subtitle">記録されるアクション</h3>
              <table className="help-table">
                <thead>
                  <tr><th>操作</th><th>記録されるアクション</th></tr>
                </thead>
                <tbody>
                  <tr><td>リンクやボタンのクリック</td><td>click</td></tr>
                  <tr><td>テキスト入力</td><td>type</td></tr>
                  <tr><td>セレクトボックスの選択</td><td>select</td></tr>
                  <tr><td>ページ遷移</td><td>navigate</td></tr>
                </tbody>
              </table>
              <h3 className="help-subtitle">タブと popup</h3>
              <p className="help-paragraph">
                録画中にリンクが新しいタブや popup ウィンドウで開かれた場合も、自動的に新しいタブとして管理されます。タブの切り替えも記録されるので、popup 内での操作もテストに含まれます。
              </p>
            </div>

            {/* アサーションを追加する */}
            <div id="assertion" className="help-section">
              <h2 className="help-section-title">アサーションを追加する</h2>
              <p className="help-paragraph">
                アサーションは「このテキストが画面に表示されていること」を確認するチェックポイントです。
                テストの合否判定に使います。
              </p>
              <h3 className="help-subtitle">追加手順</h3>
              <ol className="help-steps">
                <li>録画中に、ツールバーの <span className="help-inline-icon"><CheckIcon /></span> <strong>Assert</strong> ボタンを押します。</li>
                <li>プレビューエリアで、確認したいテキストが含まれる要素をクリックします。</li>
                <li>クリックした要素のテキストを確認するアサーションが自動的に追加されます。</li>
                <li>Assert モードは 1 回の追加後に自動で解除されます。続けて追加したい場合は再度 Assert ボタンを押してください。</li>
              </ol>
              <h3 className="help-subtitle">テスト実行時の動作</h3>
              <p className="help-paragraph">
                assert ステップは、指定され���要素に期待するテキストが含まれているかを最大 10 秒間確認し続けます。見つかれば成功、見つからなければ失敗となります。
              </p>
            </div>

            {/* テストを実行する */}
            <div id="running" className="help-section">
              <h2 className="help-section-title">テストを実行する</h2>
              <h3 className="help-subtitle">基本の実行</h3>
              <ol className="help-steps">
                <li>右パネルでテストしたいストーリーを選択します。</li>
                <li><span className="help-inline-icon"><PlayIcon /></span> <strong>Run</strong> ボタンを押します。</li>
                <li>各ステップの横に成功 <span className="help-inline-icon"><CheckIcon /></span> または失敗マークが表示されます。</li>
              </ol>
              <h3 className="help-subtitle">繰り返し実行</h3>
              <p className="help-paragraph">
                「実行回数」を 2 以上に設定して Run を押すと、テストを連続で繰り返します。結果のサマリー（例: 10/10 passed）が表示されます。
              </p>
              <h3 className="help-subtitle">セッション維持</h3>
              <p className="help-paragraph">
                「セッションを維持」にチェックを入れると、テスト実行前に Cookie やログイン状態をクリアしません。
                ログイン済みの状態でテストを続けたい場合に便利です。チェックを外すと、毎回クリーンな状態からテストが始まります。
              </p>
              <h3 className="help-subtitle">実行中の操作</h3>
              <p className="help-paragraph">
                実行中はボタンが <span className="help-inline-icon"><HourglassIcon /></span> <strong>Running...</strong> に変わります。
                <span className="help-inline-icon"><StopIcon /></span> <strong>Stop</strong> を押すと途中で中断できます。
              </p>
            </div>

            {/* ストーリーを管理する */}
            <div id="managing" className="help-section">
              <h2 className="help-section-title">ストーリーを管理する</h2>
              <h3 className="help-subtitle">タイトルの変更</h3>
              <p className="help-paragraph">
                右パネル上部のストーリー名をクリックすると、タイトルを編集できます。
              </p>
              <h3 className="help-subtitle">ステップの編集</h3>
              <ul className="help-list">
                <li><strong>編集</strong> — ステップをクリックすると、アクション・セレクタ・値を変更できます。</li>
                <li><strong>並び替え</strong> — ステップ左側のドラッグハンドルをつかんで上下に移動します。</li>
                <li><strong>複製</strong> — ステップ右側の複製ボタンで、同じ内容のステップをコピーできます。</li>
                <li><strong>挿入</strong> — ステップとステップの間にある「+ 挿入」で新しいステップを途中に追加できます。</li>
                <li><strong>削除</strong> — ステップを編集中に「Delete」ボタンで削除できます。</li>
              </ul>
              <h3 className="help-subtitle">Export / Import</h3>
              <p className="help-paragraph">
                ストーリーを JSON ファイルとして書き出し（Export）、別の環境で読み込む（Import）ことができます。
              </p>
              <ul className="help-list">
                <li><strong>Export</strong> — ツールバーの「Export All」で全ストーリーを、右パネルの「Export」で個別のストーリーを書き出します。</li>
                <li><strong>Import</strong> — ツールバーの「Import」で JSON ファイルを読み込みます。同じストーリーがある場合はコピーとして追加されます。</li>
              </ul>
            </div>

            {/* 環境変数を使う */}
            <div id="environment" className="help-section">
              <h2 className="help-section-title">環境変数を使う</h2>
              <p className="help-paragraph">
                API キーやパスワードなどの値をストーリーに直接書かずに、環境変数として管理できます。
                ストーリーを他の人と共有する際に、機密情報を含めずに済みます。
              </p>
              <h3 className="help-subtitle">ステップでの使い方</h3>
              <p className="help-paragraph">
                ステップの「値」や「Base URL」に以下の形式で記述します:
              </p>
              <div className="help-code">
                {"{{LOCAL_ENV.API_KEY}}"}
              </div>
              <p className="help-paragraph">
                テスト実行時に、Settings で設定した値に自動的に置き換えられます。
              </p>
              <h3 className="help-subtitle">Settings での設定</h3>
              <ol className="help-steps">
                <li>メニューの「Settings」または Cmd+, で Settings ウィンドウを開きます。</li>
                <li>「Environment Variables」セクションで Key と Value を入力します。</li>
                <li>Hostname を設定すると、その URL にアクセスしたときだけ環境変数が使われます。</li>
              </ol>
              <h3 className="help-subtitle">.env ファイルの取り込み</h3>
              <p className="help-paragraph">
                Settings の「Import .env」ボタンで、既存の .env ファイルを読み込むことができます。
              </p>
            </div>
        </div>
      </div>
    </section>
  );
}

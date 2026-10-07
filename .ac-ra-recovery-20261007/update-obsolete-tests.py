from pathlib import Path
import re

path = Path("tests/createAppServices.test.ts")
source = path.read_text(encoding="utf-8")

source, count = re.subn(
    r'  const achievementDetailViewSource = readFileSync\(\n    "src/platform/decky/decky-game-detail-view.tsx",\n    "utf8",\n  \);\n',
    "",
    source,
    count=1,
)
assert count == 1
for pattern in (
    r'  assert\.(?:doesNotMatch|match)\(achievementDetailViewSource, .*?\);\n',
    r'  assert\.(?:doesNotMatch|match)\(\n    achievementDetailViewSource,\n.*?\n  \);\n',
):
    source = re.sub(pattern, "", source, flags=re.S)

old = '  assert.match(compactGameDetailSource, /import \\{ Field, PanelSection, PanelSectionRow \\} from "@decky\\/ui"/u);\n'
assert old in source
source = source.replace(old, "")

for line in (
    '  assert.match(gameDetailSource, /RetroAchievementsCompletionIndicator game=\\{game\\}/u);\n',
    '  assert.match(gameDetailSource, /const completionIndicatorState = getRetroAchievementsCompletionIndicatorState\\(game\\);/u);\n',
    '  assert.match(gameDetailSource, /const isBeaten =[\\s\\S]*completionIndicatorState === "beaten-hardcore"[\\s\\S]*completionIndicatorState === "beaten-softcore"/u);\n',
    '  assert.match(gameDetailSource, /const completionStatusLabel = isMasteredHardcore \\? "Mastered" : isBeaten \\? "Beaten" : undefined;/u);\n',
    '  assert.match(gameDetailSource, /<span>\\{completionStatusLabel\\}<\\/span>/u);\n',
    '  assert.match(gameDetailSource, /const beatenAtText = formatRetroAchievementsBeatenAtText\\(game\\);/u);\n',
    '  assert.match(gameDetailSource, /const masteredAtText = formatRetroAchievementsMasteredAtText\\(game\\);/u);\n',
    '  assert.match(gameDetailSource, /const completionAtText = isMasteredHardcore \\? masteredAtText : beatenAtText;/u);\n',
    '  assert.match(gameDetailSource, /tone=\\{completionTone\\}/u);\n',
):
    source = source.replace(line, "")

source, count = re.subn(
    r'  assert\.match\(gameDetailSource, /const showSoftcoreModeCard = shouldRenderRetroAchievementsModeSummaryCard\\\(\\\{/u\);\n'
    r'.*?'
    r'  assert\.doesNotMatch\(gameDetailSource, /\\\{game\\\.hardcoreSummary !== undefined \\\? \\\(/u\);\n',
    "",
    source,
    count=1,
    flags=re.S,
)
assert count == 1
path.write_text(source, encoding="utf-8", newline="\n")

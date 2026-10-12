<script setup>
import QnaItem from "../components/lo/QnaItem.vue";
import LinkToNode from "../components/lo/LinkToNode.vue";
import { resourceUrl } from '../resourceUrls.mjs'
</script>

<template>
  <!--<NodeMapTest />-->

  <div class="about">
    <h2>{{ $t('Q&A') }}</h2>
    <QnaItem>
      <template #q> {{ $t('What is the purpose of this project?') }} </template>
      {{ $t('Optimize your') }}
      <a href="https://discord.gg/xs6Bf9w5">#worker-empire</a>
      {{ $t('to bring more silver.') }}
    </QnaItem>

    <QnaItem>
      <template #q> {{ $t('How to use?') }} </template>
      {{ $t('First of all go to') }} <strong>{{ $t('Settings') }}</strong
      >{{
        $t(
          ', select your server and tax. After that, two options are available:'
        )
      }}
      <ul>
        <li>
          {{ $t('Quick and simple: do nothing and just look at') }}
          <strong>{{ $t('Plantzones') }}</strong>
          {{
            $t(
              'page - nodes at the top are good, nodes at the bottom are bad. Use Plantzones page if just starting out.'
            )
          }}
        </li>
        <li>
          {{ $t('Personalized and nuanced: go to') }}
          <strong>{{ $t('Home') }}</strong>
          {{
            $t(
              'page, select a town on the map, hire a worker, send to whatever node gives highest efficiency, repeat (OR select a plantzone on the map and'
            )
          }}
          <strong>{{ $t('hire+assign') }}</strong>
          {{
            $t(
              'a worker with a single button). Use Home page if you want to improve or rework an existing empire (check Empire pane in top left for useful stats).'
            )
          }}
        </li>
      </ul>
    </QnaItem>

    <QnaItem>
      <template #q> {{ $t('Is there any video or guide?') }} </template>
      <a href="https://youtu.be/EknUHU1Lvq0">{{ $t('Setup and Usage') }}</a>
      {{ $t('by Yura,') }}
      <a href="https://youtu.be/sEHK7cX4SIE">{{ $t('Best Workers Video') }}</a>
      {{ $t('by Summer') }}
    </QnaItem>

    <QnaItem>
      <template #q> {{ $t('Any way to support?') }} </template>
      <a href="https://www.buymeacoffee.com/shrddr">buymeacoffee</a>
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('How do i make an empire optimized for cooking/alchemy?') }}
      </template>
      {{
        $t("Only difference is you don't tax cooking/alchemy mats (mark as")
      }}
      <strong class="notranslate">{{ $t('Keep') }}</strong>
      {{
        $t(
          'in Settings). You are still going to be recommended nodes that have nothing to do with cooking/alchemy. Just sell the output and use that silver to buy whatever you need. If you want to completely avoid some item, go to Settings and put 0 as its'
        )
      }}
      <strong class="notranslate">{{ $t('Custom Value') }}</strong
      >.
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('In send worker dialog, what does') }}
        <strong class="notranslate">{{ $t('+efficiency') }}</strong>
        {{ $t('column mean and why is it mostly negative for me?') }}
      </template>
      {{
        $t(
          'It shows the change in total efficiency (M$/day/CP) of the empire after starting this job with this worker. It being negative is good - means you already own all the best nodes, so remaining nodes reduce the current efficiency. You want to spend all available CP anyway, so just select those that are least negative (= highest in list).'
        )
      }}
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('What is') }}
        <strong class="notranslate">{{ $t('M$/day/CP') }}</strong
        >?
      </template>
      {{
        $t(
          'M$ is a million silver. M$/day is silver profit per IRL day. [M$/day] / CP is silver profit per one CP spent. In all cases, higher is better.'
        )
      }}
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('What is') }}
        <strong class="notranslate">{{ $t('efficiency') }}</strong
        >{{ $t('? Why in') }}
        <strong class="notranslate">{{ $t('Empire > Best Untaken') }}</strong>
        {{ $t('last column is called') }}
        <strong class="notranslate">{{ $t('M$/day/CP') }}</strong
        >{{ $t(', but in') }}
        <strong class="notranslate">{{ $t('Worst Taken') }}</strong>
        {{ $t("it's called") }}
        <strong class="notranslate">{{ $t('efficiency') }}</strong
        >{{
          $t(
            '? Why after taking the job its efficiency ends up being considerably less than M$/day/CP promised by Best Untaken?'
          )
        }}
      </template>
      {{
        $t(
          "Best Untaken doesn't consider connection sharing and infrastructure sharing."
        )
      }}<br />
      {{
        $t(
          'In Best Untaken, M$/day/CP of an untaken plantzone is just its M$/day divided by its CP cost.'
        )
      }}<br />
      {{
        $t(
          'For example, taking Keplan Quarry Mining brings 2.8M$/day and only costs 1CP (integer) = 2.8'
        )
      }}
      <strong class="notranslate">{{ $t('M$/day/CP') }}</strong
      >.<br />
      {{
        $t(
          'But after actually taking the Mining job, it starts sharing the node connection and town infrastructure with other jobs.'
        )
      }}<br />
      {{
        $t(
          '1CP for Mining plantzone + 0.35CP shared connection + 0.45CP in lodging and storage = 1.8CP (fractional); 2.8M$/day / 1.8CP = 1.5'
        )
      }}
      <strong class="notranslate">{{ $t('efficiency') }}</strong
      >.<br />
      {{
        $t(
          'Taking this job however reduces other Keplan jobs shared CP costs and raises their efficiency; this is hard to represent concisely in Best Untaken.'
        )
      }}
    </QnaItem>

    <QnaItem>
      <template #q>
        {{
          $t(
            'I checked the plantzones page X months ago and it showed best worker is Y and now shows Z, why?'
          )
        }}
      </template>
      {{ $t('Because central market prices change over time.') }}
    </QnaItem>

    <QnaItem>
      <template #q> {{ $t("Why can't I use Ancado workers?") }} </template>
      {{
        $t(
          "This is the only ingame town that requires connecting to some other town to be able to function properly. Workerman keeps this requirement but since you can't do arbitrary connections there's a checkbox in Ancado town config that does that for you"
        )
      }}
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('What does') }}
        <strong class="notranslate">{{ $t('wasm router') }}</strong>
        {{ $t('checkbox do?') }}
      </template>
      {{
        $t(
          'This is an experimental new way of connecting nodes, better than the old one in most cases.'
        )
      }}<br />
      <details>
        <summary>
          {{
            $t(
              'By default (if not checked) you are using the old order-dependent routing which has the following limitations:'
            )
          }}
        </summary>
        <div style="padding-left: 1em">
          <QnaItem>
            <template #q>
              {{
                $t(
                  'Why are node connections so bad? When building path from town'
                )
              }}
              <strong class="notranslate">A</strong> {{ $t('to node') }}
              <strong class="notranslate">B</strong
              >{{
                $t(', it ignores the fact that there is already taken node')
              }}
              <strong class="notranslate">C</strong> {{ $t('on the way.') }}
            </template>
            {{
              $t(
                "Connections are resolved in same order the jobs were given. The worker who received the job first doesn't know yet about all others, and builds connection in a beeline. Each next worker sees and uses more and more connections made by previous workers in queue. You can push the worker at"
              )
            }}
            <strong class="notranslate">B</strong>
            {{
              $t(
                'to the end of queue by restarting his job in workerman (press'
              )
            }}
            <strong class="notranslate">{{ $t('stop') }}</strong>
            {{
              $t(
                'and assign again). His connection will then be built last, with full knowledge of previous connections including the one that activated'
              )
            }}
            <strong class="notranslate">C</strong>.
          </QnaItem>
          <QnaItem>
            <template #q>
              {{
                $t(
                  "No matter how I change the order of jobs, I still can't achieve the optimal routing I have in mind."
                )
              }}
            </template>
            {{ $t('Cases like these') }}<br />
            <img
              :src="resourceUrl('data/images/steiner.png')"
              loading="lazy"
              decoding="async"
            /><br />
            {{
              $t(
                "can't be routed optimally by old router, you'll get either B←A→C, A→B→C or A→C→B all costing 4 CP."
              )
            }}<br />
            {{ $t('To get both B and C with 3 CP you need to mark S as') }}
            <strong class="notranslate">{{
              $t('zero-cost (invested for droprate)')
            }}</strong
            >.
          </QnaItem>
        </div>
      </details>
    </QnaItem>

    <QnaItem>
      <template #q>
        {{
          $t(
            'How does the giant bonus work? Is it not just average goblin yield increased by 68.4%?'
          )
        }}
      </template>
      {{
        $t(
          'It is not, because of rounding down, which makes giants worse than expected. Low yield nodes are more affected by rounding, since'
        )
      }}
      <code>floor(1*1.684)=1</code>.
      <ul>
        <li>
          {{
            $t('yields of a specific item at a specific plantzone follow a')
          }}
          <a href="https://en.wikipedia.org/wiki/Binomial_distribution">{{
            $t('binomial')
          }}</a>
          {{ $t('distribution with parameters') }} <i>n</i>
          {{ $t('(number of rolls) and') }} <i>p</i>
          {{ $t('(roll success chance)') }}
        </li>
        <ul>
          <li>
            {{
              $t(
                'some of them were leaked at some point, some inferred by observation'
              )
            }}
          </li>
        </ul>
        <li>
          {{ $t('for goblins and humans, the') }} <i>np</i>
          {{ $t('product is straight up the average yield per cycle') }}
          <ul>
            <li>
              {{
                $t(
                  "doesn't matter if it's 10 rolls with 0.8 chance each or 100 rolls with 0.08 chance each, long term it will average out to 8 items per cycle"
                )
              }}
            </li>
          </ul>
        </li>
        <li>{{ $t("for giants, it's more complicated:") }}</li>
        <ul>
          <li>
            <details>
              <summary>
                {{
                  $t(
                    'build the distribution of non-giant yields and their chances (need at least a rough estimate of both'
                  )
                }}
                <i>n</i> {{ $t('and') }} <i>p</i>)
              </summary>
              <img
                :src="resourceUrl('data/images/yields_gob.webp')"
                loading="lazy"
                decoding="async"
              />
            </details>
          </li>
          <li>
            <details>
              <summary>
                {{
                  $t(
                    'build the distribution of giant yields by keeping the same observations, but increase each integer yield 68.4% rounded down'
                  )
                }}
              </summary>
              <img
                :src="resourceUrl('data/images/yields_gia.webp')"
                loading="lazy"
                decoding="async"
              />
            </details>
          </li>
          <li>
            {{
              $t(
                'do a weighted sum back into average yield per cycle specifically for giants, which turns out less than 1.684'
              )
            }}<i>np</i>{{ $t(', but how much less depends on') }} <i>n</i>
            {{ $t('and') }} <i>p</i>
          </li>
        </ul>
      </ul>
    </QnaItem>

    <QnaItem>
      <template #q> {{ $t('What are stat ranks?') }} </template>
      {{
        $t(
          'Worker stat consist of innate stats (those he was born with, always the same) and those gained through levelups (random in a range).'
        )
      }}<br />
      {{
        $t(
          'If levelup range for a given stat is 1.0-2.0, rolling 1.4 is 40% rank, and rolling 1.9 is 90% rank.'
        )
      }}<br />
      {{
        $t(
          'Rank 50% level 3 worker means 2 avg rolls (1.5+1.5=3.0), or one min roll and one max roll (1.0+2.0=3.0), or any combination of rolls giving 3.0 total stat increase.'
        )
      }}<br />
      {{
        $t(
          'Rank 100% level 40 worker means 39 max rolls in a row (2.0*39=78.0).'
        )
      }}<br />
      {{
        $t(
          '"+stat per level" skills are not accounted for when calculating rank, so you can potentially have >100% rank (by having >78.0 stat gained through levelups).'
        )
      }}
    </QnaItem>

    <QnaItem>
      <template #q>
        {{ $t('Where does the drop data come from and how old?') }}
      </template>
      {{
        $t(
          '1. Unlucky drops up to Eternal Winter: from an anonymous source somewhere on the internet, timestamped late 2021. I checked ~50 top profit nodes ingame and they matched, so the rest are assumed good.'
        )
      }}<br />
      {{ $t('2. Unlucky drops in Eternal Winter: observed near mid 2022.')
      }}<br />
      {{ $t('3. Lucky drops across all regions: observed in june 2023.')
      }}<br />
      {{
        $t(
          '4. Morning Land drops: observed at summer 2023 - regular nodes are fine, excavations are approximate, too rare to judge confidently (see'
        )
      }}
      <a
        href="https://discord.com/channels/371035077037129729/404532586246045696/1284834924381212704"
        >{{ $t('table') }}</a
      >).<br />
      {{
        $t(
          '5. Seoul drops: observed non-thoroughly in september 2024, when in doubt picked values most similar to existing node drops from (1).'
        )
      }}<br />
      {{ $t('6. Ulukita drops: observed in june 2025.') }}<br />
      {{ $t('7. Edania drops: observed in august 2025.') }}<br />
      {{ $t('8. 31+4 patch: observed in june 2026.') }}<br />
      {{
        $t(
          'I\'ve been adjusting all of the above over time when relevant changes were published in patch notes, like "increased yields at node X by Y%".'
        )
      }}
    </QnaItem>

    <h2>{{ $t('Tips & tricks') }}</h2>
    <ul style="padding-left: 16px">
      <li>
        <details>
          <summary>
            {{
              $t('Anywhere you see a right facing triangle, click to expand')
            }}
          </summary>
          {{ $t('after it turns downwards, click again to hide') }}
        </details>
      </li>
      <li>
        {{ $t('Also hover over') }}
        <abbr class="tooltip" :title="$t('water is wet')">ℹ</abbr
        >{{ $t("'s and other") }}
        <abbr class="tooltip" :title="$t('water is blue')">{{
          $t('dot-underlined')
        }}</abbr>
        {{ $t('things to see useful info') }}
      </li>
      <li>
        {{ $t('Spend some time on item valuation in') }}
        <RouterLink to="/settings">{{ $t('Settings') }}</RouterLink
        >{{ $t(': set') }}
        <strong class="notranslate">{{ $t('Custom') }}</strong>
        {{
          $t(
            "value above market price for bottlenecked stuff, reduce the value for mats you don't want"
          )
        }}
      </li>
      <li>
        {{ $t('Home page >') }}
        <strong class="notranslate">{{ $t('Empire') }}</strong>
        {{ $t('pane has some useful stats. Get rid of') }}
        <strong class="notranslate">{{ $t('Worst Taken') }}</strong>
        {{ $t('and acquire') }}
        <strong class="notranslate">{{ $t('Best Untaken') }}</strong>
      </li>
      <li>
        {{ $t('Use') }}
        <strong class="notranslate">{{ $t('optimize') }}</strong>
        {{
          $t(
            "button inside a working worker's editor and see what skills to roll to maximize profit, then"
          )
        }}
        <strong class="notranslate">{{ $t('revert') }}</strong> {{ $t('back') }}
      </li>
      <ul>
        <li>
          {{
            $t(
              'if you\'re not max level though, level up with 🠕 button first to see what the "endgame" optimal skills are as opposed to currently optimal skills'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'you can also change the type of worker (expert↔artisan or even goblin↔giant) here and the stats will be recalculated as if levelled from scratch with same stat rolls'
            )
          }}
        </li>
      </ul>
      <li>
        {{ $t('If you have nodes invested for grinding, mark them with') }}
        <strong class="notranslate">{{ $t('zero-cost connection') }}</strong>
        {{ $t('checkbox - this will make nearby plantzones more desirable') }}
      </li>
      <ul>
        <li>
          {{
            $t(
              "just like with ordinary nodes, order matters - if grinding connections (shown in orange) don't want to chain properly, try to reorder them (ex: activate Olun before Crypt). Order is shown in"
            )
          }}
          <strong class="notranslate">{{ $t('Total CP') }}</strong>
          {{ $t('pane') }}
        </li>
        <li>
          {{
            $t(
              'if a zero-cost autoconnects to a wrong town, assign intermediate zero-costs along the path you want (usually just 1 dummy halfway is enough)'
            )
          }}
        </li>
      </ul>
      <li>
        {{ $t('Use') }} <strong class="notranslate">{{ $t('import') }}</strong>
        {{ $t('and') }} <strong class="notranslate">{{ $t('export') }}</strong>
        {{ $t('buttons in') }}
        <strong class="notranslate">{{ $t('All towns/workers list') }}</strong>
        {{ $t('to:') }}
        <ul>
          <li>{{ $t('compare different builds') }}</li>
          <li>{{ $t('restore to a known state when messed up') }}</li>
          <li>{{ $t('share your setup with other people') }}</li>
          <li>
            {{
              $t(
                'pull actual worker stats from your PC (ty @Aman, @Thell, @Sbreeng, @thirtyeight):'
              )
            }}
          </li>
          <ul>
            <li>
              {{ $t('download and install') }}
              <a href="https://www.python.org/">Python</a> 3.9+
            </li>
            <li>
              {{ $t('download the') }}
              <a href="https://pastebin.com/XpbwtqPA">cache2json</a>
              {{ $t('script, and run it through Python') }}
            </li>
            <li>
              {{
                $t(
                  'now head back to Workerman Home page > All towns/workers list > import the json file you just created by running the script'
                )
              }}
            </li>
          </ul>
          <li>
            {{
              $t(
                'in case wrong or outdated jobs are retrieved, pay attention to what the script prints, is it using an incorrect or outdated cache file?'
              )
            }}
          </li>
          <li>
            {{
              $t(
                'warning: if the totals in top right corner show ? after the import, you probably exceeded the F2P town limits for lodging/storage. look for towns marked red in'
              )
            }}
            <strong class="notranslate">{{ $t('All towns/workers') }}</strong>
            {{ $t('list and adjust their') }}
            <strong class="notranslate">{{ $t('config > P2W') }}</strong>
            {{ $t('numbers') }}
          </li>
          <li>
            {{ $t("note: the script doesn't really fetch") }}
            <i>{{ $t('current') }}</i>
            {{
              $t(
                'jobs, but the jobs associated with ingame "restart job" button of each worker.'
              )
            }}
          </li>
          <ul>
            <li>
              {{ $t('even if the worker is stopped but has "restart job"') }}
              <img
                :src="resourceUrl('data/images/restart.png')"
                class="icon"
                loading="lazy"
              />
              {{ $t('and "clear restart"') }}
              <img
                :src="resourceUrl('data/images/clear_restart.png')"
                class="icon"
                loading="lazy"
              />
              {{ $t('buttons ingame active, his job is cached.') }}
            </li>
            <li>
              {{
                $t(
                  'you can have two ingame workers with same cached job (but only one actually working). there is zero protection against that in workerman. don\'t leave dangling jobs - use "clear restart" ingame button.'
                )
              }}
            </li>
            <li>
              {{
                $t(
                  'even after firing/selling the ingame worker, his job remains cached.'
                )
              }}
            </li>
            <li>
              {{
                $t(
                  'the only way to remove cached jobs of fired workers seems to be: delete the cache file while the game is running and wait for it to be recreated (during load screen).'
                )
              }}
            </li>
          </ul>
        </ul>
      </li>
      <li>
        {{ $t('Workloads (and therefore profits) depend on') }}
        <RouterLink to="/resources">{{ $t('Resources') }}</RouterLink
        >{{
          $t(
            '. The default value works well for highly contested nodes (they are popular for a reason - you probably want them too). Some niche nodes however can report up to 2x higher profit if you enter their real Resource values.'
          )
        }}
        <ul>
          <li>
            {{
              $t(
                'Each green bar ingame does not belong to single resource node, but to a piece of land (aka RegionGroup), which may can contain multiple resource nodes, so they share the resource %.'
              )
            }}
          </li>
          <ul>
            <li>
              <details>
                <summary>
                  {{
                    $t(
                      "RegionGroup borders can be somewhat seen on ingame map > Resource view, though some people say they can't (probably depends on graphics settings)."
                    )
                  }}
                </summary>
                <img
                  :src="resourceUrl('data/images/regiongroup.png')"
                  loading="lazy"
                  decoding="async"
                />
              </details>
            </li>
          </ul>
          <li>
            {{
              $t(
                'If you want to be really meticulous about it, switch to floating mode (in'
              )
            }}
            <RouterLink to="/resources">{{ $t('Resources') }}</RouterLink>
            {{
              $t(
                '> Advanced) and track the ingame resources change over time. More observations - more accuracy.'
              )
            }}
          </li>
          <ul>
            <li>
              {{
                $t(
                  'With floating resources, daily profit is calculated via the chance of reaching relevant workload breakpoints on each cycle. Detailed view available in edit worker dialog.'
                )
              }}
            </li>
            <li>
              {{
                $t(
                  'Workloads shown in ~XXX format refer to median (50% chance) value. This is for reference only and is not used in profit calculations, the whole dataset is.'
                )
              }}
            </li>
            <li>
              {{
                $t(
                  'You can opt in to use floating resource only for specific RegionGroups.'
                )
              }}
            </li>
          </ul>
        </ul>
      </li>
      <li>
        {{ $t('Try') }}
        <a href="https://github.com/Thell/bdo-empire">bdo-empire</a>
        {{
          $t(
            'which takes a while to run, but creates an empire from scratch given a target amount of CP (and its output can be imported back into workerman)'
          )
        }}
        <ul>
          <li>
            {{
              $t(
                'It uses Calpheon as stash for all workers, so after the import you may need to reassign stashes (to whatever your main town is, or spread out across multiple towns)'
              )
            }}
          </li>
        </ul>
      </li>
    </ul>

    <h2>{{ $t('Changelog') }}</h2>
    <ul style="padding-left: 16px">
      <li>
        {{
          $t('fall back to arsha.io prices for items not served by bdolytics')
        }}
      </li>
      <li>{{ $t('[2026-08-13 patch] Edania pt2 with 14 plantzones') }}</li>
      <ul>
        <li>{{ $t('✓ connections') }}</li>
        <li>{{ $t('✓ walk distances') }}</li>
        <li>{{ $t('✓ housecraft') }}</li>
        <li>{{ $t('✓ droprates v7 (cycles observed: 3990)') }}</li>
      </ul>
      <li>{{ $t('[2026-07-02 patch] thrifty skill reworked') }}</li>
      <li>
        {{
          $t(
            '[2026-06-04 patch] plantzone changes (droprates v8 based on 35k observed cycles)'
          )
        }}
        <details>
          <summary>{{ $t('31 new') }}</summary>
          <LinkToNode :nodeKey="2082" />, <LinkToNode :nodeKey="2081" />,
          <LinkToNode :nodeKey="2077" />, <LinkToNode :nodeKey="2076" />,
          <LinkToNode :nodeKey="2075" />, <LinkToNode :nodeKey="2070" />,
          <LinkToNode :nodeKey="2069" />, <LinkToNode :nodeKey="2066" />,
          <LinkToNode :nodeKey="2065" />, <LinkToNode :nodeKey="207" />,
          <LinkToNode :nodeKey="208" />, <LinkToNode :nodeKey="2084" />,
          <LinkToNode :nodeKey="2083" />, <LinkToNode :nodeKey="2061" />,
          <LinkToNode :nodeKey="2060" />, <LinkToNode :nodeKey="2078" />,
          <LinkToNode :nodeKey="2068" />, <LinkToNode :nodeKey="206" />,
          <LinkToNode :nodeKey="209" />, <LinkToNode :nodeKey="2067" />,
          <LinkToNode :nodeKey="2080" />, <LinkToNode :nodeKey="2063" />,
          <LinkToNode :nodeKey="2062" />, <LinkToNode :nodeKey="2059" />,
          <LinkToNode :nodeKey="2058" />, <LinkToNode :nodeKey="2079" />,
          <LinkToNode :nodeKey="2074" />, <LinkToNode :nodeKey="2073" />,
          <LinkToNode :nodeKey="2072" />, <LinkToNode :nodeKey="2071" />,
          <LinkToNode :nodeKey="2064" />
        </details>
        <details>
          <summary>{{ $t('4 changed') }}</summary>
          <LinkToNode :nodeKey="201" />, <LinkToNode :nodeKey="202" />,
          <LinkToNode :nodeKey="1675" />,
          <LinkToNode :nodeKey="1676" />
        </details>
      </li>
      <li>
        {{ $t('[2026-06-04 patch] some node and house CP costs reduced') }}
      </li>
      <li>
        {{ $t('price spinner follows CM steps and supports k/m/b suffix') }}
      </li>
      <li>{{ $t('[2026-03-26 patch] new Frozen Halo node') }}</li>
      <li>
        {{
          $t(
            '[2026-01-08 patch] trade wagons carry 2x weight, price per LT reduced 10x'
          )
        }}
      </li>
      <li>{{ $t('[2025-08-28 patch] updated Edania housing') }}</li>
      <li>
        {{ $t('[2025-07-21 patch] added new Edania area with 15 plantzones') }}
      </li>
      <ul>
        <li>{{ $t('✓ connections') }}</li>
        <li>{{ $t('✓ walk distances') }}</li>
        <li>{{ $t('✓ housecraft') }}</li>
        <li>{{ $t('✓ droprates v7 (cycles observed: ~2400)') }}</li>
      </ul>
      <li>
        {{
          $t(
            'a consistent fast way to build optimal connections (orderless) by @Thell'
          )
        }}
      </li>
      <li>{{ $t('sticky table headers') }}</li>
      <li>{{ $t('show product icon for workshop jobs') }}</li>
      <li>
        {{ $t('[2025-05-29 patch] there are now 5 trade wagons instead of 1') }}
      </li>
      <li>{{ $t('[2025-05-22 patch] Reduced CP costs of houses') }}</li>
      <li>{{ $t('[2025-05-22 patch] Reduced CP costs of nodes') }}</li>
      <li>
        {{
          $t(
            '[2025-05-22 patch] Added 12 plantzones in Ulukita + 4 around Keplan'
          )
        }}
      </li>
      <ul>
        <li>{{ $t('droprates: v6 (cycles observed: ~22k)') }}</li>
      </ul>
      <li>
        {{ $t('Plantzones page >') }}
        <strong class="notranslate">{{ $t('hide taken') }}</strong>
        {{ $t('checkbox') }}
      </li>
      <li>
        {{ $t('In Empire > Best untaken,') }}
        <strong class="notranslate">{{ $t('stash') }}</strong>
        {{ $t('dropbox has new') }}
        <strong class="notranslate">{{ $t('ignore storage cost') }}</strong>
        {{ $t('option.') }}
      </li>
      <li>
        {{ $t('In Empire > Best untaken and selected Plantzone pane,') }}
        <strong class="notranslate">{{ $t('stash') }}</strong>
        {{ $t('dropbox has new') }}
        <strong class="notranslate">{{ $t('cheapest storage 🧊') }}</strong>
        {{ $t('option.') }}
      </li>
      <ul>
        <li>
          {{ $t('it does apply to') }}
          <strong class="notranslate">{{ $t('assign') }}</strong>
          {{
            $t(
              'action, but is frozen in a sense that it means cheapest at this point in time, and not a commitment to keep it cheapest going forward (after adding more jobs).'
            )
          }}
        </li>
      </ul>
      <li>
        <strong class="notranslate">{{ $t('Town config > storage') }}</strong>
        {{ $t('view shows item source on mouseover') }}
      </li>
      <li>
        {{ $t('Ctrl+F on') }}
        <strong class="notranslate">{{ $t('Home') }}</strong>
        {{
          $t(
            'page searches for items and node names, Esc to remove highlight. If you need builtin Chrome search it is still accessible through F3'
          )
        }}
      </li>
      <li>
        {{ $t('[2024-11-21 patch] updated Yukjo houses to have more lodging') }}
      </li>
      <li>{{ $t("worker seals don't require town storage space anymore") }}</li>
      <li>{{ $t('[2024-09-12 patch] added Seoul area with 19 nodes') }}</li>
      <li>
        {{
          $t(
            'can assign Personal Items in Muzgar > config (do not enter too much, will show'
          )
        }}
        <strong class="notranslate">?</strong> {{ $t('in totals)') }}
      </li>
      <li>
        {{
          $t(
            'Home page > selected plantzone pane > added "hire+assign" section, which autosuggests best race'
          )
        }}
      </li>
      <li>{{ $t('custom prices import/export') }}</li>
      <li>{{ $t('workshop tweaks') }}</li>
      <ul>
        <li>
          {{ $t('worker packing skills now improve profit (please review') }}
          <strong class="notranslate">{{ $t('$/cycle') }}</strong>
          {{ $t('column in') }}
          <RouterLink to="/settings">{{ $t('Settings') }}</RouterLink>
          {{
            $t(
              '> 🏭Workshops config, probably needs to be reduced if you set it to 4x before)'
            )
          }}
        </li>
        <li>
          {{ $t('skill #1008 (refining) affects crate packing workspeed') }}
        </li>
        <li>
          {{
            $t(
              'added intracity distances for workshops (and improved intercity)'
            )
          }}
        </li>
        <li>
          {{ $t('remote town workshop job requires (creates) a connection') }}
        </li>
        <li>
          {{
            $t(
              'Home page > selected town pane has workshop section, sorted by type'
            )
          }}
        </li>
      </ul>
      <li>
        {{
          $t(
            'fixed unexpected lodging redirect when using "send worker to" dialog > stash dropdown set to a remote town'
          )
        }}
      </li>
      <li>
        {{
          $t('added feed calc to Home > Empire > Daily yields (scroll down)')
        }}
      </li>
      <li>{{ $t('map: added a setting to hide all inactive elements') }}</li>
      <li>
        {{
          $t(
            'if any of jobs originating in a town has negative income, this town lodgage costs will be split between jobs equally (not proportionally)'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'allowed storage use at oquilla, asparkan, velandir, muzgar (muzgar is also slightly upgradeable)'
          )
        }}
      </li>
      <li>
        {{
          $t('updated all trace plantzones to output same amount of item 5960')
        }}
      </li>
      <li>
        {{
          $t(
            'updated sack 1024 to contain 1x item 5205 and sack 1026 to contain 1x item 5960'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'changed plantzone 1560 to use Lumbering lucky drops despite having Gathering icon, tweaked a couple of trace droprates'
          )
        }}
      </li>
      <li>
        {{
          $t(
            '[2023-05-31 patch] new luck drops (current version: 13 aka the final one. data collection stopped)'
          )
        }}
      </li>
      <ul>
        <li>
          {{
            $t(
              'all nodes of kind 4 (plant growing): all luck drops replaced with 0.3x item 1024'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'all nodes of kind 6 (plant gathering): all luck drops replaced with 0.13x item 1024'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'all nodes of kind 7 (mining): all luck drops replaced with 3.5x item 1025'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'all nodes of kind 8 (lumbering): all luck drops replaced with 1x item 5005, 0.5x 5006, 0.15x 5007, 2.1x 5008, 1x 5011'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'all nodes of kind 11 (dried fish): all luck drops replaced with 0.17x item 1027, 0.77x 6501'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'all nodes of kind 15 (excavation): all luck drops replaced with 4x item 1026'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'nodes 1675, 1677, 1776: unlucky drop increased to 8 (not mentioned in patch notes, maybe happened on an earlier date)'
            )
          }}
        </li>
        <li>{{ $t('nodes 1565, 1779: added 2x luck procs') }}</li>
      </ul>
      <li>{{ $t('added TW language') }}</li>
      <li>{{ $t('Plantzones page > added town filter') }}</li>
      <li>
        {{
          $t('[2024-01-31 patch] extended Ulukita area (still 0 plantzones)')
        }}
      </li>
      <li>{{ $t('added JP language') }}</li>
      <li>
        {{ $t('[2023-11-08 patch] replaced junk yields with ores at') }}
        <details>
          <summary>
            {{ $t('10 excavation nodes. yields are approximate') }}
          </summary>
          <LinkToNode :nodeKey="144" />, <LinkToNode :nodeKey="480" />,
          <LinkToNode :nodeKey="488" />, <LinkToNode :nodeKey="842" />,
          <LinkToNode :nodeKey="902" />, <LinkToNode :nodeKey="912" />,
          <LinkToNode :nodeKey="1220" />, <LinkToNode :nodeKey="1553" />,
          <LinkToNode :nodeKey="1687" />,
          <LinkToNode :nodeKey="1688" />
        </details>
      </li>

      <li>
        {{
          $t(
            '[2023-11-08 patch] increased lumbering byproducts yields by set multipliers at'
          )
        }}
        <details>
          <summary>{{ $t('17 lumbering nodes') }}</summary>
          <LinkToNode :nodeKey="142" />, <LinkToNode :nodeKey="167" />,
          <LinkToNode :nodeKey="183" />, <LinkToNode :nodeKey="455" />,
          <LinkToNode :nodeKey="464" />, <LinkToNode :nodeKey="834" />,
          <LinkToNode :nodeKey="855" />, <LinkToNode :nodeKey="905" />,
          <LinkToNode :nodeKey="908" />, <LinkToNode :nodeKey="952" />,
          <LinkToNode :nodeKey="1212" />, <LinkToNode :nodeKey="1215" />,
          <LinkToNode :nodeKey="1216" />, <LinkToNode :nodeKey="1219" />,
          <LinkToNode :nodeKey="1777" />, <LinkToNode :nodeKey="1820" />,
          <LinkToNode :nodeKey="1821" />
        </details>
      </li>
      <li>{{ $t('[2023-11-01 patch] increased all trace yields') }}</li>
      <ul>
        <li>
          <details>
            <summary>{{ $t('Main continent: x2') }}</summary>
            <LinkToNode :nodeKey="144" />, <LinkToNode :nodeKey="480" />,
            <LinkToNode :nodeKey="488" />, <LinkToNode :nodeKey="842" />,
            <LinkToNode :nodeKey="902" />, <LinkToNode :nodeKey="912" />,
            <LinkToNode :nodeKey="1220" />, <LinkToNode :nodeKey="1553" />,
            <LinkToNode :nodeKey="1637" />, <LinkToNode :nodeKey="1687" />,
            <LinkToNode :nodeKey="1688" />, <LinkToNode :nodeKey="1709" />,
            <LinkToNode :nodeKey="1716" />, <LinkToNode :nodeKey="1720" />,
            <LinkToNode :nodeKey="1770" />,
            <LinkToNode :nodeKey="1778" />
          </details>
        </li>
        <li>
          <details>
            <summary>{{ $t('Morning land: x5') }}</summary>
            <LinkToNode :nodeKey="1807" />, <LinkToNode :nodeKey="1808" />,
            <LinkToNode :nodeKey="1809" />, <LinkToNode :nodeKey="1823" />,
            <LinkToNode :nodeKey="1830" />
          </details>
        </li>
      </ul>
      <li>{{ $t('[2023-11-01 patch] increased all sap yields') }}</li>
      <ul>
        <li>
          <details>
            <summary>{{ $t('Maple & Pine Sap: x1.5') }}</summary>
            <LinkToNode :nodeKey="443" />, <LinkToNode :nodeKey="910" />,
            <LinkToNode :nodeKey="1216" />,
            <LinkToNode :nodeKey="1685" />
          </details>
        </li>
        <li>
          <details>
            <summary>{{ $t('Snowfield Cedar Sap: x5') }}</summary>
            <LinkToNode :nodeKey="1771" />,
            <LinkToNode :nodeKey="1780" />
          </details>
        </li>
        <li>
          <details>
            <summary>{{ $t('Other Sap: x2') }}</summary>
            <LinkToNode :nodeKey="160" />, <LinkToNode :nodeKey="840" />,
            <LinkToNode :nodeKey="901" />, <LinkToNode :nodeKey="903" />,
            <LinkToNode :nodeKey="907" />, <LinkToNode :nodeKey="1212" />,
            <LinkToNode :nodeKey="1215" />, <LinkToNode :nodeKey="1219" />,
            <LinkToNode :nodeKey="1502" />, <LinkToNode :nodeKey="1504" />,
            <LinkToNode :nodeKey="1512" />, <LinkToNode :nodeKey="1516" />,
            <LinkToNode :nodeKey="1526" />, <LinkToNode :nodeKey="1635" />,
            <LinkToNode :nodeKey="1638" />, <LinkToNode :nodeKey="1683" />,
            <LinkToNode :nodeKey="1684" />, <LinkToNode :nodeKey="1686" />,
            <LinkToNode :nodeKey="1712" />, <LinkToNode :nodeKey="1715" />,
            <LinkToNode :nodeKey="1560" />
          </details>
        </li>
      </ul>
      <li>
        {{
          $t(
            'implemented manual output redirection (available at any worker level for easier prototyping)'
          )
        }}
      </li>
      <li>
        {{ $t('added separate VP setting to add 16 P2W slots to every town') }}
      </li>
      <li>
        {{ $t('[2023-08-23 patch] added new Ulukita area with 0 plantzones') }}
      </li>
      <li>{{ $t('added KR language') }}</li>
      <li>
        {{ $t('[2023-03-10 patch] item 4206 yields tripled at 3 plantzones') }}
      </li>
      <li>
        {{ $t('housing config > items are now sorted exactly as ingame') }}
      </li>
      <li>
        {{
          $t(
            'home page > added worker icon, level, and optional stat rank (also always shown in editor)'
          )
        }}
      </li>
      <li>{{ $t('added lodgage costs to Empire > Best Untaken') }}</li>
      <li>
        {{
          $t(
            'skip unknown (event?) plantzone jobs when importing - will display as an idle worker instead'
          )
        }}
      </li>
      <li>
        {{ $t('Empire > Best Untaken selects best species automatically') }}
      </li>
      <li>{{ $t('[2023-06-05 patch] added node 1833') }}</li>
      <li>{{ $t('[2023-05-31 patch] big rework') }}</li>
      <ul>
        <li>{{ $t('level cap 40, +2 skill slots') }}</li>
        <li>{{ $t('humans got +3 luck') }}</li>
        <li>
          {{ $t('giants got +68.4% yield of') }} <s>{{ $t('all') }}</s>
          {{ $t('all unlucky drops, rounded down') }}
        </li>
      </ul>
      <li>
        {{
          $t(
            'fixed warehouse slot calculations to require lucky items too + 1 slot required to be free'
          )
        }}
      </li>
      <li>{{ $t('[2023-06-14 patch] added LotML area with 24 nodes') }}</li>
      <li>{{ $t('in darkmode, buttons are now actually dark') }}</li>
      <li>
        {{
          $t('[2023-05-31 patch] added sack items with auto-calculated prices')
        }}
      </li>
      <ul>
        <li>{{ $t('item 1024 = equal chance of 1x any fruit') }}</li>
        <li>{{ $t('item 1025 = equal chance of 1x any gem') }}</li>
        <li>{{ $t('item 1026 = equal chance of 1x any trace') }}</li>
        <li>{{ $t('item 1027 = equal chance of 1x any coral') }}</li>
      </ul>
      <li>
        {{
          $t(
            "you don't buy houses anymore, optimal lodging & storage provided automatically"
          )
        }}
      </li>
      <ul>
        <li>
          {{ $t('check town') }}
          <strong class="notranslate">{{ $t('config') }}</strong>
          {{ $t('to see which houses to buy') }}
        </li>
        <li>
          {{
            $t('be careful to not exceed the town limits, profits will show')
          }}
          <strong class="notranslate">NaN</strong>{{ $t("'s and") }}
          <strong class="notranslate">?</strong
          >{{ $t("'s if you do, and whole town marked red in town list") }}
        </li>
        <li>
          {{
            $t('for easier prototyping, idle workers do not consume lodging')
          }}
        </li>
      </ul>
      <li>{{ $t('[2023-05-03 patch] reduced 10 fences cost to 80 CP') }}</li>
      <li>
        {{ $t('reimplemented workshop jobs to stay after worker reimport') }}
      </li>
      <ul>
        <li>
          {{ $t('each house can be set up in') }}
          <RouterLink to="/settings">{{ $t('Settings') }}</RouterLink> &gt;
          <strong class="notranslate">{{ $t('Workshops config') }}</strong>
          {{ $t('and stored separately from worker data') }}
        </li>
        <li>
          {{ $t('previously assigned') }}
          <strong class="notranslate">{{ $t('🏭Workshop') }}</strong>
          {{ $t('jobs have been converted into') }}
          <strong class="notranslate">{{ $t('✍️Custom') }}</strong>
          {{ $t('jobs') }}
        </li>
      </ul>
      <li>{{ $t('on town/node click, map pans to its location') }}</li>
      <li>{{ $t('removed 13 nodes that are invisible ingame') }}</li>
      <li>{{ $t('added a ranking of untaken nodes in Empire pane') }}</li>
      <li>{{ $t('[2023-02-21 patch] updated node CP costs') }}</li>
      <li>
        {{
          $t(
            'job efficiency now includes lodging cost: eff = income / (connectionCost + lodgingCost)'
          )
        }}
      </li>
      <ul>
        <li>
          {{
            $t(
              'lodging costs are shared proportionally to job income values, same way as connections'
            )
          }}
        </li>
      </ul>
      <li>{{ $t('added more worker types + seamless transition between') }}</li>
      <li>
        {{
          $t(
            'can specify a zero-cost connection in node properties (when invested for droprate)'
          )
        }}
      </li>
      <li>{{ $t('individual plantzone efficiency via cashflow') }}</li>
      <ul>
        <li>
          {{
            $t(
              'ex: if a connection node is simultaneously used by a 4M$/day job and a 1M$/day job, they own it in 80/20 fashion'
            )
          }}
        </li>
      </ul>
      <li>
        {{ $t('added farming and workshop job types in Send Worker dialog') }}
      </li>
      <li>{{ $t('/plantzones page tweaks') }}</li>
      <ul>
        <li>
          {{
            $t(
              'node name link navigates to its map location (upd: with permalinks)'
            )
          }}
        </li>
        <li>{{ $t('item link navigates to its settings price row') }}</li>
        <li>{{ $t('shows item names to allow in-browser search') }}</li>
        <li>{{ $t('selects nearest town by CP instead of distance') }}</li>
      </ul>
      <li>{{ $t("removed Blue Maned Lion's Manor") }}</li>
      <li>{{ $t('~floating resources support') }}</li>
      <li>{{ $t('selecting a node highlights connection path') }}</li>
      <li>
        {{ $t('worker job assignment moves to the end of connection queue') }}
      </li>
      <li>
        {{
          $t(
            'worker editor: added button to suggest best skills for current job'
          )
        }}
      </li>
      <li>{{ $t('map: color active/inactive links') }}</li>
      <li>
        {{
          $t('updated connection algorithm to encourage existing paths reuse')
        }}
      </li>
      <li>{{ $t('[2022-10-26 patch] updated house CP costs') }}</li>
      <li>{{ $t('worker revert button, plantzone luck effect indicator') }}</li>
      <li>{{ $t('configurable default worker for hire') }}</li>
      <li>{{ $t('send worker dialog: show worker stats') }}</li>
      <li>
        {{
          $t('worker editor: when on job, show profit changes while editing')
        }}
      </li>
      <li>{{ $t('node info: show/edit the resource%') }}</li>
      <li>
        {{
          $t(
            'Ancado lodging now requires other town connection (nearest chosen automatically)'
          )
        }}
      </li>
      <li>{{ $t('added nodes 911..914 & 1604 (ty @Ayashi)') }}</li>
      <li>{{ $t('added total daily items summary') }}</li>
      <li>{{ $t('added workers+lodging import/export to json file') }}</li>
      <li>{{ $t('[2022-09-21 patch] updated several node distances') }}</li>
      <li>{{ $t('added worker management') }}</li>
      <li>{{ $t('combined repeated items in node 1035 (ty @Yazel)') }}</li>
      <li>
        {{
          $t(
            '[2022-08-31 patch] modified nodes 463 & 487 for lucky drop 5422 instead of 5402'
          )
        }}
      </li>
    </ul>

    <h2>{{ $t('Todo') }}</h2>
    <ul style="padding-left: 16px">
      <li>
        {{
          $t(
            '"unable to resolve housing" warning should have the town name clickable'
          )
        }}
      </li>
      <li>
        {{
          $t(
            '"how much more $ a lucky cycle brings vs unlucky" is outdated: does not take the giant bonus into account'
          )
        }}
      </li>
      <li>
        {{ $t('make empire > best untaken use existing workers as an option') }}
      </li>
      <li>
        {{
          $t(
            'workshop name should include node name instead of affiliated town'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'remote workshops require node connections, check if shared correctly'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'stacking outputs from everywhere in 1 town makes that town less efficient - incorrect'
          )
        }}
      </li>
      <li>{{ $t('copy workshops button - stop including connection CP') }}</li>
      <li>{{ $t('show qty in town pane - yield tooltip') }}</li>
      <li>{{ $t('empty personal items are treated as 1 personal item') }}</li>
      <li>{{ $t('personal items increase worker CP') }}</li>
      <li>{{ $t('crates - show mat usage per day') }}</li>
      <li>
        {{
          $t(
            "monk's branch rate is sus on plantzones where it is both unlucky and lucky"
          )
        }}
      </li>
      <li>{{ $t('worker send dialog > stash > ulukita towns = error') }}</li>
      <li>{{ $t('leveling a worker up/down needs to be faster') }}</li>
      <li>{{ $t('[2024-11-21 patch] palace stuff maybe') }}</li>
      <li>
        {{
          $t(
            'add "max P2W" button to set all worker slots / storage space to max pearlable'
          )
        }}
      </li>
      <ul>
        <li>{{ $t('what\'s "max pearlable"?') }}</li>
      </ul>
      <li>
        {{
          $t(
            'worker ranks are in linear stat space, should probably rework it to use "chance of achieving" space'
          )
        }}
        <ul>
          <li>
            {{
              $t(
                'ex: 98.55 workspeed giant shows as 56% rank when actually it is top 10% in "chance of achieving" space'
              )
            }}
          </li>
        </ul>
      </li>
      <li>
        {{
          $t(
            'for some reason mousemove while hovering a node triggers continuous recalculations'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'change (again) the job resource sharing principle when negative profit jobs are involved'
          )
        }}
      </li>
      <ul>
        <li>
          {{
            $t(
              'when positive profit jobs A, B and negative profit jobs C, D are sharing the same resource, A and B should split half of the resource proprtionally to their profits, while C and D should split the remaining half of the resource equally'
            )
          }}
        </li>
      </ul>
      <li>
        {{
          $t(
            'home > when hovering an inactive plantzone, show the profit estimate (with optimal worker from optimal town?)'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'need to rethink default "random art gob" hire since gobs are not BiS anymore'
          )
        }}
      </li>
      <ul>
        <li>
          {{ $t('a quick popup would be nice right after clicking') }}
          <strong>{{ $t('hire') }}</strong> {{ $t('asking 👺 or 🐢') }}
        </li>
        <li>
          {{
            $t(
              'need to get a list of hireables per town to hire town-specific kind of 👺'
            )
          }}
        </li>
        <ul>
          <li>
            {{ $t('investigate via worker registration items (id 64000+)') }}
          </li>
        </ul>
      </ul>
      <li>{{ $t('totals pane > split out personal items storage CP') }}</li>
      <ul>
        <li>{{ $t('make multiple queries to housecraft and compare') }}</li>
      </ul>
      <li>
        {{
          $t(
            "handle lodging/storage in steps (like in AstroAllano's sheet) instead of linear sharing"
          )
        }}
      </li>
      <ul>
        <li>{{ $t('same idea with connections') }}</li>
      </ul>
      <li>
        {{ $t('worker editor > hide charkeys not hireable in current town') }}
      </li>
      <li>{{ $t('smart worker↔job rearrangement within a town') }}</li>
      <ul>
        <li>
          {{
            $t(
              'take both innate stat, current skills and potential reroll prospects into account'
            )
          }}
        </li>
      </ul>
      <li>{{ $t('on first run, pick server using geoip') }}</li>
      <li>
        {{
          $t(
            "some of morningland workers' levelup stats still unknown, using values from older cities"
          )
        }}
      </li>
      <li>{{ $t('[2023-05-31 patch]') }}</li>
      <ul>
        <li>
          {{ $t('implement species-restricted plantzones and workshops') }}
        </li>
      </ul>
      <li>
        {{
          $t(
            'when exporting/importing, show what exactly is being -ported (maybe even choose with checkboxes?)'
          )
        }}
      </li>
      <li>{{ $t('show real house positions in housecraft viewer') }}</li>
      <li>
        {{
          $t(
            'when optimizing skills, try to keep new skill of same type at same position as old one'
          )
        }}
      </li>
      <ul>
        <li>{{ $t("don't optimize +2 wspd into +2 wspd with no benefit") }}</li>
      </ul>
      <li>{{ $t('add lodging/storage support to workshop system') }}</li>
      <li>{{ $t('on item icon hover: show tooltip with name and price') }}</li>
      <li>{{ $t('workerlist: show drops instead of pzname') }}</li>
      <li>{{ $t('grade towns/workers graphically with bar charts') }}</li>
      <li>
        {{ $t('map tweaks') }}
        <ul>
          <li>{{ $t('node hover: highlight potential path to town') }}</li>
          <li>{{ $t('deal with missing tiles') }}</li>
        </ul>
      </li>
      <li>{{ $t('profit calculation: include feed cost') }}</li>
      <li>{{ $t('map: optionally show RegionGroups') }}</li>
      <li>
        {{
          $t(
            'unify job description strings - node 1565 should say "silk production" like ingame workerlist'
          )
        }}
      </li>
      <li>{{ $t('introduce skill roll chances somehow') }}</li>
      <ul>
        <li>
          {{
            $t('help decide which skills should and should not be rerolled?')
          }}
        </li>
        <li>
          {{
            $t(
              "ex: for existing worker skill, show if it's going to get better or worse after 5 rerolls"
            )
          }}
        </li>
      </ul>
      <li>
        {{
          $t(
            'detect unsellable items using current market offers divided by lifetime volume'
          )
        }}
      </li>
      <ul>
        <li>{{ $t('different items have different lifetime though') }}</li>
      </ul>
      <li>{{ $t('detect and apply price floors and ceilings (±7.5%)') }}</li>
      <li>{{ $t('show the age of last market fetch') }}</li>
      <li>
        {{
          $t(
            'apparently OBS in Capture Window mode does not capture basic HTML tooltips, only custom rolled CSS ones'
          )
        }}
      </li>
      <li>
        {{
          $t(
            'try precalculating the best species (with skills) for each town-plantzone pair'
          )
        }}
      </li>
      <ul>
        <li>
          {{
            $t(
              'this will not work - luck skill decisions depend on lucky items prices'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'it is however possible to precalculate all skills that are not luck, so only 3 skills require placement in runtime'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'can add a button "calculate now" though; tie to price snapshot hash?'
            )
          }}
        </li>
        <li>
          {{
            $t(
              'could allow for correct and fast 👺/🐢 in node pane and elsewhere'
            )
          }}
        </li>
      </ul>
    </ul>

    <h2>{{ $t('Misc') }}</h2>
    <p>
      <RouterLink to="/workshops">{{ $t('House Usage') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/housecraft">{{ $t('HouseCraft Viewer') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/droprates">{{ $t('Droprates') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/fishsize">{{ $t('Fishsize') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/routertests">{{ $t('Router Tests') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/regionmap">{{ $t('RegionGroup Map') }}</RouterLink>
    </p>
    <p>
      <RouterLink to="/lodging">{{
        $t('All Towns Lodging (deprecated)')
      }}</RouterLink>
    </p>
  </div>
</template>

<style scoped>
summary {
  cursor: pointer;
}

strong {
  font-weight: 600;
}

.tooltip {
  cursor: help;
}

.icon {
  height: 1em; /* Match the text height */
  vertical-align: middle; /* Align it properly */
}
</style>

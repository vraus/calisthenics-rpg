interface MasteredFamily {
  familyName: string;
  masteredCount: number;
  totalCount: number;
  masteredNames: string[];
}

interface BadgeEntry {
  slug: string;
  name: string;
  description: string;
  earnedAt?: string;
}

interface PersonalRecord {
  name: string;
  value: number;
  unit: "reps" | "s";
}

export default function ProfileView({
  level,
  totalXp,
  sessionCount,
  streak,
  masteredByFamily,
  badges,
  records,
}: {
  level: number;
  totalXp: number;
  sessionCount: number;
  streak: { current: number; longest: number };
  masteredByFamily: MasteredFamily[];
  badges: BadgeEntry[];
  records?: PersonalRecord[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="panel-rpg p-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted">Niveau global</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{level}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Séances loggées</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{sessionCount}</p>
        </div>
        <div>
          <p className="text-sm text-muted">XP total</p>
          <p className="font-display text-2xl font-bold text-accent-strong">{Math.round(totalXp)}</p>
        </div>
        <div>
          <p className="text-sm text-muted">Streak</p>
          <p className="font-display text-2xl font-bold text-gold">
            {streak.current} 🔥 <span className="font-sans text-sm text-muted">(record {streak.longest})</span>
          </p>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Exercices maîtrisés</h2>
        <ul className="flex flex-col gap-2">
          {masteredByFamily.map((f) => (
            <li key={f.familyName} className="panel-rpg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.familyName}</span>
                <span className="text-muted">
                  {f.masteredCount}/{f.totalCount}
                </span>
              </div>
              {f.masteredNames.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {f.masteredNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full border border-gold px-2 py-0.5 text-xs text-gold"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {records ? (
        <section>
          <h2 className="text-sm font-medium text-muted mb-2">Records personnels</h2>
          {records.length === 0 ? (
            <p className="text-sm text-muted">Aucune séance enregistrée pour l&apos;instant.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {records.map((record) => (
                <li key={record.name} className="panel-rpg p-3 flex items-center justify-between text-sm">
                  <span>{record.name}</span>
                  <span className="text-gold font-medium">
                    {record.value} {record.unit}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium text-muted mb-2">Badges</h2>
        <ul className="flex flex-col gap-2">
          {badges.map((badge) => (
            <li
              key={badge.slug}
              className={`p-3 flex items-center justify-between gap-3 ${
                badge.earnedAt
                  ? "panel-rpg panel-rpg-gold"
                  : "rounded-lg border border-border bg-locked text-muted"
              }`}
            >
              <div>
                <p className="font-medium text-sm">{badge.name}</p>
                <p className="text-xs">{badge.description}</p>
              </div>
              {badge.earnedAt ? <span className="text-gold text-sm font-medium">✓</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

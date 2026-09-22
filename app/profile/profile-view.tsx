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
  const earnedBadges = badges.filter((b) => b.earnedAt);
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
        <h2 className="text-sm font-medium text-muted mb-2">
          Badges {earnedBadges.length > 0 ? `(${earnedBadges.length})` : null}
        </h2>
        {earnedBadges.length === 0 ? (
          <p className="text-sm text-muted">Aucun badge obtenu pour l&apos;instant.</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2">
            {earnedBadges.map((badge) => (
              <li
                key={badge.slug}
                title={badge.description}
                className="panel-rpg panel-rpg-gold p-3 flex flex-col items-center gap-1 text-center"
              >
                <span className="text-gold text-lg">🏆</span>
                <p className="text-xs font-medium leading-tight">{badge.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

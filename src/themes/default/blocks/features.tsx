'use client';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { ScrollAnimation } from '@/shared/components/ui/scroll-animation';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Features({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-16 md:py-24', section.className, className)}
    >
      <div className={`container space-y-10 md:space-y-18`}>
        <ScrollAnimation>
          <div className="mx-auto max-w-3xl text-center text-balance">
            <h2 className="text-foreground mb-5 text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
              {section.title}
            </h2>
            <p className="text-muted-foreground mx-auto mb-8 max-w-2xl leading-7 md:mb-12 lg:mb-14">
              {section.description}
            </p>
          </div>
        </ScrollAnimation>

        <ScrollAnimation delay={0.2}>
          <div className="relative mx-auto grid divide-x divide-y border *:p-12 sm:grid-cols-2 lg:grid-cols-3">
            {section.items?.map((item, idx) => (
              <div className="space-y-3" key={idx}>
                <div className="flex items-center gap-2">
                  <SmartIcon name={item.icon as string} size={24} />
                  <h3 className="text-sm font-medium">{item.title}</h3>
                </div>
                <p className="text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

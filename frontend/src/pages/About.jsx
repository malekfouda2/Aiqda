import { motion } from 'framer-motion';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, slideInLeft, slideInRight } from '../utils/animations';

const teamMembers = [
  {
    name: 'Abdulwahed Alabdlee',
    title: 'Managing Partner & Trainer Consultant',
    initials: 'AA',
    gradient: 'from-primary-400 to-primary-600',
    achievements: [
      'Currently serving as the Chairman of the Animation Society in Saudi Arabia since 2021.',
      'Honored by the U.S. Embassy in Saudi Arabia for contributing in the Gaming Development Workshop.',
      'Received international awards for outstanding contributions in the film industry.',
      'Co-director of Captain Munch which won several awards: Animatex, Animex Awards, 11th Showreel: Effat International Student Film Festival, Rassam International Short Film Festival.',
    ],
  },
  {
    name: 'Michael Murengezi',
    title: 'Education Partner & Trainer',
    initials: 'MM',
    gradient: 'from-cyan-400 to-blue-600',
    achievements: [
      'Worked as a Story Artist at Triggerfish Studios, Netflix.',
      'Honored by the Animation Society in Saudi Arabia with a trophy for participation.',
      'Director of Captain Munch which won several awards: Animatex, Animex Awards, 11th Showreel: Effat International Student Film Festival, Rassam International Short Film Festival.',
    ],
  },
];

function About() {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
    >
      <section className="relative overflow-hidden pt-32 pb-24">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb w-[500px] h-[500px] bg-primary-100/40 top-[-150px] left-[-100px] animate-float" />
          <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/35 bottom-[-100px] right-[-80px] animate-float-slow" />
          <div className="floating-orb w-[250px] h-[250px] bg-orange-100/25 top-1/3 right-1/4 animate-glow-pulse" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div variants={fadeInUp}>
            <motion.div
              variants={slideInLeft}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6"
            >
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Our Story</span>
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              One Center,{' '}
              <span className="gradient-text text-glow">All Things</span>
              <br />
              <span className="text-gray-900">Animation</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Inspiring and nurturing the next generation of visionary animators
              in Saudi Arabia — blending cultural heritage with innovative
              storytelling.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gray-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <motion.div variants={slideInLeft}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-5">
                <span className="w-2 h-2 bg-primary-400 rounded-full" />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">Our Vision</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-6 leading-snug">
                Shaping the{' '}
                <span className="gradient-text">Future</span>{' '}
                of Animation
              </h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                24 Center inspires and nurtures the next generation of visionary
                animators in Saudi Arabia, blending cultural heritage with
                innovative storytelling to shape the future of animation.
              </p>
            </motion.div>

            <motion.div variants={slideInRight}>
              <div className="relative p-8 bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-50 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />
                <div className="relative">
                  <div className="text-5xl font-black gradient-text text-glow mb-4">"</div>
                  <blockquote className="text-xl font-semibold text-gray-800 leading-relaxed">
                    Empowering Saudi Arabia's future animators to creatively
                    blend cultural heritage with innovative storytelling.
                  </blockquote>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-sm text-gray-400 font-medium uppercase tracking-widest">Our Message</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">Leadership</span>
            </div>
            <h2 className="text-4xl font-bold text-gray-900">
              Meet Our <span className="gradient-text">Team</span>
            </h2>
            <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
              Award-winning industry professionals leading Aiqda's mission to
              elevate animation education.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            className="grid lg:grid-cols-2 gap-8"
          >
            {teamMembers.map((member) => (
              <motion.div
                key={member.name}
                variants={cardVariants}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden group"
              >
                <div className="p-8">
                  <div className="flex items-start gap-5 mb-6">
                    <div
                      className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg`}
                    >
                      {member.initials}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {member.name}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {member.title}
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-3">
                    {member.achievements.map((item, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="mt-1.5 w-5 h-5 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        </span>
                        <span className="text-gray-600 text-sm leading-relaxed">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="h-1 bg-gradient-to-r from-transparent via-primary-200 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-br from-primary-50 to-cyan-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
          >
            <motion.div variants={fadeInUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
                <span className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">Contact</span>
              </div>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Ready to <span className="gradient-text">Elevate</span> Your Skills?
              </h2>
              <p className="text-gray-500 text-lg mb-2">
                Get in touch with us and start your animation journey today.
              </p>
              <a
                href="mailto:info@24center.edu.sa"
                className="text-primary-500 hover:text-primary-600 font-semibold text-lg transition-colors"
              >
                info@24center.edu.sa
              </a>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}

export default About;

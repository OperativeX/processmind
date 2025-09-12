import React from 'react';
import {
  Box,
  Container,
  Typography,
  Divider,
  Link,
} from '@mui/material';
import PublicLayout from '../../layouts/PublicLayout';

const TermsPage = () => {
  const sections = [
    {
      title: '1. Annahme der Bedingungen',
      content: [
        {
          text: 'Durch den Zugriff auf oder die Nutzung von ProcessLink ("Dienst") erklären Sie sich mit diesen Nutzungsbedingungen ("Bedingungen") einverstanden. Wenn Sie mit einem Teil dieser Bedingungen nicht einverstanden sind, haben Sie keine Berechtigung, auf den Dienst zuzugreifen.'
        }
      ]
    },
    {
      title: '2. Dienstbeschreibung',
      content: [
        {
          text: 'ProcessLink ist eine SaaS-Plattform, die KI-gestützte Videotranskription, Analyse und Wissensmanagemendienste bereitstellt. Der Dienst umfasst Video-Upload, Verarbeitung, Transkription mit KI-Technologie, automatisches Tagging, Todo-Extraktion und Visualisierungsfunktionen.'
        }
      ]
    },
    {
      title: '3. Benutzerkonten',
      content: [
        {
          subtitle: '3.1 Kontoerstellung',
          text: 'Um bestimmte Funktionen des Dienstes zu nutzen, müssen Sie ein Konto registrieren. Sie verpflichten sich, während der Registrierung genaue, aktuelle und vollständige Informationen bereitzustellen und diese Informationen zu aktualisieren, um sie genau, aktuell und vollständig zu halten.'
        },
        {
          subtitle: '3.2 Kontosicherheit',
          text: 'Sie sind für die Sicherung des Passworts und für alle Aktivitäten verantwortlich, die unter Ihrem Konto stattfinden. Sie müssen uns unverzüglich benachrichtigen, wenn Sie von einer Sicherheitsverletzung oder unbefugten Nutzung Ihres Kontos erfahren.'
        },
        {
          subtitle: '3.3 Kontokündigung',
          text: 'Sie können Ihr Konto jederzeit kündigen. Wir behalten uns das Recht vor, Ihr Konto zu sperren oder zu kündigen, wenn Sie gegen diese Bedingungen verstoßen oder aus anderen Gründen nach unserem alleinigen Ermessen.'
        }
      ]
    },
    {
      title: '4. Nutzerinhalte',
      content: [
        {
          subtitle: '4.1 Ihre Inhalte',
          text: 'Sie behalten alle Rechte an den Videoinhalten und anderen Materialien, die Sie auf den Dienst hochladen ("Nutzerinhalte"). Durch das Hochladen von Nutzerinhalten gewähren Sie ProcessLink eine begrenzte, nicht-exklusive Lizenz zur Verarbeitung, Speicherung und Anzeige Ihrer Inhalte ausschließlich zum Zweck der Bereitstellung des Dienstes.'
        },
        {
          subtitle: '4.2 Inhaltsbeschränkungen',
          text: 'Sie verpflichten sich, keine Inhalte hochzuladen, die: (a) Urheberrechte, Marken oder andere Eigentumsrechte verletzen; (b) verleumderisches, obzsönes oder rechtswidriges Material enthalten; (c) Viren oder schädlichen Code enthalten; (d) gegen geltende Gesetze oder Vorschriften verstoßen.'
        },
        {
          subtitle: '4.3 Inhaltsentfernung',
          text: 'Wir behalten uns das Recht vor, Nutzerinhalte zu entfernen, die gegen diese Bedingungen verstoßen oder aus anderen Gründen nach unserem Ermessen.'
        }
      ]
    },
    {
      title: '5. Zulässige Nutzung',
      content: [
        {
          text: 'Sie verpflichten sich, (a) den Dienst nicht für rechtswidrige Zwecke zu nutzen; (b) nicht zu versuchen, den Dienst zu stören oder zu unterbrechen; (c) nicht zu versuchen, auf das Konto eines anderen Nutzers zuzugreifen; (d) keine automatisierten Skripte zu verwenden, um Informationen vom Dienst zu sammeln; (e) keinen Aspekt des Dienstes zurückzuentwickeln; (f) den Dienst nicht ohne unsere Erlaubnis weiterzuverkaufen oder zu verteilen.'
        }
      ]
    },
    {
      title: '6. Zahlung und Abrechnung',
      content: [
        {
          subtitle: '6.1 Abonnementpläne',
          text: 'Der Dienst wird unter verschiedenen Abonnementplänen angeboten. Sie verpflichten sich, alle Gebühren zu zahlen, die mit Ihrem gewählten Plan verbunden sind.'
        },
        {
          subtitle: '6.2 Zahlungsabwicklung',
          text: 'Zahlungen werden über Drittanbieter-Zahlungsdienstleister abgewickelt. Durch die Bereitstellung von Zahlungsinformationen ermächtigen Sie uns, die anfallenden Gebühren von Ihrer Zahlungsmethode abzubuchen.'
        },
        {
          subtitle: '6.3 Rückerstattungen',
          text: 'Abonnementgebühren sind nicht erstattungsfähig, außer gesetzlich vorgeschrieben oder ausdrücklich in unserer Rückerstattungsrichtlinie angegeben.'
        },
        {
          subtitle: '6.4 Preisänderungen',
          text: 'Wir behalten uns das Recht vor, unsere Preise zu ändern. Wir werden Sie im Voraus über Preiserhöhungen informieren, die Ihr Abonnement betreffen.'
        }
      ]
    },
    {
      title: '7. Geistiges Eigentum',
      content: [
        {
          subtitle: '7.1 Unser Eigentum',
          text: 'Der Dienst und seine ursprünglichen Inhalte (ausgenommen Nutzerinhalte), Funktionen und Funktionalitäten sind Eigentum von ProcessLink und durch internationale Urheberrechts-, Marken- und andere Gesetze zum geistigen Eigentum geschützt.'
        },
        {
          subtitle: '7.2 Feedback',
          text: 'Jegliches Feedback, Vorschläge oder Ideen, die Sie über den Dienst bereitstellen, können von uns ohne Verpflichtung zur Entschädigung verwendet werden.'
        }
      ]
    },
    {
      title: '8. Datenschutz',
      content: [
        {
          text: 'Ihre Nutzung des Dienstes unterliegt auch unserer Datenschutzrichtlinie, die durch Verweis in diese Bedingungen aufgenommen wird. Bitte lesen Sie unsere Datenschutzrichtlinie, um unsere Praktiken zu verstehen.'
        }
      ]
    },
    {
      title: '9. Dienste Dritter',
      content: [
        {
          text: 'Der Dienst kann Links zu Websites oder Diensten Dritter enthalten, die nicht im Besitz oder unter der Kontrolle von ProcessLink sind. Wir haben keine Kontrolle über und übernehmen keine Verantwortung für die Inhalte, Datenschutzrichtlinien oder Praktiken von Websites oder Diensten Dritter.'
        }
      ]
    },
    {
      title: '10. Haftungsausschlüsse',
      content: [
        {
          subtitle: '10.1 Dienst "Wie besehen"',
          text: 'Der Dienst wird "wie besehen" und "wie verfügbar" bereitgestellt. Wir schließen ausdrücklich alle Gewährleistungen jeglicher Art aus, ob ausdrücklich oder stillschweigend, einschließlich, aber nicht beschränkt auf die stillschweigenden Gewährleistungen der Marktgängigkeit, Eignung für einen bestimmten Zweck und Nichtverletzung.'
        },
        {
          subtitle: '10.2 Keine Garantie',
          text: 'Wir garantieren nicht, dass der Dienst ununterbrochen, zeitnah, sicher oder fehlerfrei sein wird oder dass Mängel behoben werden.'
        }
      ]
    },
    {
      title: '11. Haftungsbeschränkung',
      content: [
        {
          text: 'In keinem Fall haften ProcessLink, seine Direktoren, Mitarbeiter, Partner, Vertreter, Lieferanten oder Tochtergesellschaften für indirekte, zufällige, besondere, Folge- oder Strafschäden, einschließlich, ohne Einschränkung, Gewinnverlust, Datenverlust, Nutzungsausfall, Verlust des Geschäftswerts oder andere immaterielle Verluste, die aus Ihrer Nutzung des Dienstes resultieren.'
        }
      ]
    },
    {
      title: '12. Freistellung',
      content: [
        {
          text: 'Sie verpflichten sich, ProcessLink und seine verbundenen Unternehmen gegen alle Ansprüche, Verbindlichkeiten, Schäden, Urteile, Zuerkennungen, Verluste, Kosten, Ausgaben oder Gebühren zu verteidigen, zu entschädigen und schadlos zu halten, die aus oder im Zusammenhang mit Ihrer Verletzung dieser Bedingungen oder Ihrer Nutzung des Dienstes entstehen.'
        }
      ]
    },
    {
      title: '13. Geltendes Recht',
      content: [
        {
          text: 'Diese Bedingungen unterliegen den Gesetzen von [Ihre Rechtsordnung] und sind nach diesen auszulegen, ohne Berücksichtigung der Kollisionsnormen. Rechtliche Schritte oder Verfahren sind ausschließlich vor den Gerichten in [Ihre Rechtsordnung] zu erheben.'
        }
      ]
    },
    {
      title: '14. Änderungen der Bedingungen',
      content: [
        {
          text: 'Wir behalten uns das Recht vor, diese Bedingungen jederzeit zu ändern. Bei wesentlichen Änderungen werden wir Sie per E-Mail oder durch eine Benachrichtigung im Dienst informieren. Ihre fortgesetzte Nutzung des Dienstes nach solchen Änderungen gilt als Annahme der neuen Bedingungen.'
        }
      ]
    },
    {
      title: '15. Salvatorische Klausel',
      content: [
        {
          text: 'Sollte eine Bestimmung dieser Bedingungen als nicht durchsetzbar oder ungültig erachtet werden, wird diese Bestimmung geändert und ausgelegt, um die Ziele dieser Bestimmung im größtmöglichen Umfang gemäß geltendem Recht zu erreichen, und die übrigen Bestimmungen bleiben in vollem Umfang gültig.'
        }
      ]
    },
    {
      title: '16. Gesamte Vereinbarung',
      content: [
        {
          text: 'Diese Bedingungen stellen die gesamte Vereinbarung zwischen Ihnen und ProcessLink bezüglich der Nutzung des Dienstes dar und ersetzen alle früheren Vereinbarungen zwischen Ihnen und ProcessLink in Bezug auf den Dienst.'
        }
      ]
    },
    {
      title: '17. Kontaktinformationen',
      content: [
        {
          text: 'Wenn Sie Fragen zu diesen Bedingungen haben, kontaktieren Sie uns bitte unter:'
        },
        {
          text: 'E-Mail: rechtliches@processlink.de\nAdresse: ProcessLink GmbH\n[Ihre Adresse]\n[Stadt, PLZ]'
        }
      ]
    }
  ];

  return (
    <PublicLayout>
      {/* Header */}
      <Box sx={{ py: 8, backgroundColor: 'background.default' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h1"
            align="center"
            sx={{
              fontWeight: 700,
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              mb: 3,
              background: 'linear-gradient(45deg, #7c3aed 30%, #a855f7 90%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nutzungsbedingungen
          </Typography>
          <Typography
            variant="h6"
            align="center"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Gültig ab: Dezember 2024
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ maxWidth: '800px', mx: 'auto' }}
          >
            Bitte lesen Sie diese Nutzungsbedingungen sorgfältig durch, bevor Sie ProcessLink nutzen. 
            Diese Bedingungen regeln Ihre Nutzung unserer Plattform und Dienste.
          </Typography>
        </Container>
      </Box>

      {/* Content */}
      <Box sx={{ py: 8, backgroundColor: 'background.paper' }}>
        <Container maxWidth="md">
          {sections.map((section, index) => (
            <Box key={index} sx={{ mb: 6 }}>
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 600,
                  mb: 3,
                  color: 'primary.main',
                }}
              >
                {section.title}
              </Typography>
              {section.content.map((item, itemIndex) => (
                <Box key={itemIndex} sx={{ mb: 3 }}>
                  {item.subtitle && (
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        mb: 1,
                      }}
                    >
                      {item.subtitle}
                    </Typography>
                  )}
                  {item.text && (
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{
                        lineHeight: 1.8,
                        whiteSpace: 'pre-line',
                      }}
                    >
                      {item.text}
                    </Typography>
                  )}
                </Box>
              ))}
              {index < sections.length - 1 && (
                <Divider sx={{ mt: 4 }} />
              )}
            </Box>
          ))}

          {/* Footer Note */}
          <Box
            sx={{
              mt: 8,
              p: 4,
              backgroundColor: 'background.default',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              Fragen zu unseren Bedingungen?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Wenn Sie Fragen haben oder Klärung zu unseren Nutzungsbedingungen benötigen, 
              ist unser Team hier, um zu helfen. Wir glauben an Transparenz und erklären gerne 
              jeden Aspekt dieser Bedingungen.
            </Typography>
            <Link
              href="/contact"
              sx={{
                color: 'primary.main',
                textDecoration: 'none',
                fontWeight: 500,
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              Rechtsteam kontaktieren →
            </Link>
          </Box>
        </Container>
      </Box>
    </PublicLayout>
  );
};

export default TermsPage;
import { FormControl, FormGroup } from '@angular/forms';

export interface CoordonneesContactForm {
  nom: FormControl<string>;
  prenom: FormControl<string>;
  telephone: FormControl<string>;
  mail: FormControl<string>;
  rue: FormControl<string>;
  code_postal: FormControl<string>;
  ville: FormControl<string>;
  pays: FormControl<string>;
  tva: FormControl<string>;
}

export interface NouvelleCommandeForm {
  nom_commande: FormControl<string>;
  deadline: FormControl<string>;
  coordonnees_contact: FormGroup<CoordonneesContactForm>;
  description_projet: FormControl<string>;
  dimensions_souhaitees: FormControl<string>;
  couleur: FormControl<string[]>;
  support: FormControl<string>;
  police_ecriture: FormControl<string>;
  texte_personnalisation: FormControl<string>;
  fichiers_joints: FormControl<File[]>;
  quantité: FormControl<number>;
}

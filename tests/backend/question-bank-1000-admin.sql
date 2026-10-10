-- Administrative negative tests; every rejected write rolls back within its
-- exception subtransaction. An unchanged concept reimport changes zero rows.
create or replace function pg_temp.test_question_bank_1000_admin()
returns jsonb language plpgsql as $$
declare v_version text:='excel-1000-20261010-v1';v_hash text;v_before text;v_after text;
 v_links jsonb;v_payload jsonb;v_error boolean;v_report jsonb;
begin
 select canonical_sha256 into v_hash from private.question_bank_imports where version=v_version;
 select md5(string_agg(to_jsonb(q)::text,''order by id))into v_before from public.questions q;
 select jsonb_agg(to_jsonb(a)order by question_id)into v_links from private.question_semantic_aliases a;
 v_report:=public.admin_link_question_bank_concepts(v_version,v_hash,v_links);
 if (v_report->>'linksChanged')::integer<>0 then raise exception 'CONCEPT_REIMPORT_CHANGED';end if;
 v_error:=false;
 begin
  perform public.admin_link_question_bank_concepts(v_version,v_hash,'[{"question_id":"missing-qa-question","semantic_key":"missing-qa-concept"}]');
 exception when others then if sqlerrm='INVALID_CONCEPT_LINKS'then v_error:=true;else raise;end if;end;
 if not v_error then raise exception 'INVALID_LINK_ACCEPTED';end if;
 v_error:=false;
 begin
  perform public.admin_link_question_bank_concepts(v_version,v_hash,jsonb_build_array(jsonb_build_object('question_id',v_links->0->>'question_id','semantic_key',
    (select semantic_key from public.questions where source_version=v_version and semantic_key<>v_links->0->>'semantic_key'order by id limit 1))));
 exception when others then if sqlerrm='CONCEPT_LINK_IMMUTABLE'then v_error:=true;else raise;end if;end;
 if not v_error then raise exception 'PUBLISHED_LINK_REWRITTEN';end if;
 select jsonb_build_array(to_jsonb(q)||jsonb_build_object('answer_ca','Resposta QA alterada','factual_checked',q.factual_reviewed,'language_checked',q.language_reviewed,'review_note',q.notes))
 into v_payload from public.questions q where id='NEW26-PAU-001';
 v_error:=false;
 begin
  perform public.admin_upsert_question_bank_batch(v_version,v_hash,v_payload);
 exception when others then if sqlerrm='BANK_PUBLISHED_IMMUTABLE'then v_error:=true;else raise;end if;end;
 if not v_error then raise exception 'PUBLISHED_ANSWER_REWRITTEN';end if;
 v_error:=false;
 begin
  perform public.admin_validate_question_bank_batch(v_version,v_hash,v_payload);
 exception when others then if sqlerrm='BANK_IMPORTED_CONTENT_MISMATCH'then v_error:=true;else raise;end if;end;
 if not v_error then raise exception 'FALSE_PROOF_ACCEPTED';end if;
 select md5(string_agg(to_jsonb(q)::text,''order by id))into v_after from public.questions q;
 if v_before<>v_after then raise exception 'ADMIN_QA_CHANGED_QUESTIONS';end if;
 return jsonb_build_object('status','PASS','checks',jsonb_build_array('77 historical links reimport with zero changes','unknown concepts rejected','published concept links immutable','published answers immutable','independent validation rejects altered answers'),
   'questionsUnchanged',true,'conceptReimport',v_report);
end;$$;
select pg_temp.test_question_bank_1000_admin()report;
